/* In-memory Google Apps Script services for tests/gameday-rules.mjs. */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function createBackend() {
  const sheets = {};
  const cache = {};
  const flags = { boom: false, lockFail: false, lockWaits: 0, lockHeld: false };
  let seq = 0;

  function makeSheet() {
    const rows = [];
    return {
      appendRow(values) {
        rows.push(Array.from(values));
      },
      getLastRow() {
        return rows.length;
      },
      deleteRow(row) {
        rows.splice(row - 1, 1);
      },
      getDataRange() {
        return {
          getValues() {
            if (flags.boom) throw new Error("SECRET_STACK");
            const width = rows.reduce(function (max, line) { return Math.max(max, line.length); }, 0);
            return rows.map(function (line) {
              const copy = line.slice();
              while (copy.length < width) copy.push("");
              return copy;
            });
          }
        };
      },
      getRange(row, column, numRows, numColumns) {
        const height = numRows == null ? 1 : numRows;
        const width = numColumns == null ? 1 : numColumns;
        return {
          setValues(values) {
            for (let i = 0; i < height; i++) {
              while (rows.length < row + i) rows.push([]);
              const line = rows[row - 1 + i];
              const src = values[i] || [];
              for (let j = 0; j < width; j++) {
                while (line.length < column + j) line.push("");
                line[column - 1 + j] = src[j];
              }
            }
          }
        };
      }
    };
  }

  const context = {
    SpreadsheetApp: {
      getActive() {
        return {
          getSheetByName(name) {
            return sheets[name] || null;
          },
          insertSheet(name) {
            sheets[name] = makeSheet();
            return sheets[name];
          }
        };
      }
    },
    LockService: {
      getScriptLock() {
        return {
          waitLock() {
            if (flags.lockFail) throw new Error("busy");
            flags.lockWaits += 1;
            flags.lockHeld = true;
          },
          releaseLock() {
            flags.lockHeld = false;
          }
        };
      }
    },
    CacheService: {
      getScriptCache() {
        return {
          get(key) {
            return Object.prototype.hasOwnProperty.call(cache, key) ? cache[key] : null;
          },
          put(key, value) {
            cache[key] = String(value);
          }
        };
      }
    },
    Utilities: {
      getUuid() {
        seq += 1;
        return "00000000-0000-4000-8000-" + String(seq).padStart(12, "0");
      }
    },
    ContentService: {
      MimeType: { JSON: "JSON" },
      createTextOutput(text) {
        return {
          setMimeType(mime) {
            return { text: text, mime: mime };
          }
        };
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, "apps-script/gameday.gs"), "utf8"), context, {
    filename: "apps-script/gameday.gs"
  });

  function reset() {
    Object.keys(sheets).forEach(function (key) { delete sheets[key]; });
    Object.keys(cache).forEach(function (key) { delete cache[key]; });
    flags.boom = false;
    flags.lockFail = false;
    flags.lockWaits = 0;
    flags.lockHeld = false;
  }

  return {
    flags: flags,
    reset: reset,
    get: function (eventId) {
      return context.handleGet({ parameter: { event: eventId } });
    },
    post: function (body) {
      return context.handlePost({ postData: { contents: JSON.stringify(body) } });
    },
    postRaw: function (raw) {
      return context.handlePost({ postData: { contents: raw } });
    },
    handlePost: context.handlePost,
    doGet: context.doGet,
    doPost: context.doPost
  };
}
