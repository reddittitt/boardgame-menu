# Rulebook sources

These files gained an invisible text layer with `ocrmypdf --redo-ocr --output-type pdf --optimize 0`. Pages were not deskewed, cleaned, or re-rendered. Embedded image streams match the source, and spot-checked page renders are pixel-identical.

Local entries started from the file already in this repo. The source URL is the copy the site was already serving. Remote entries were downloaded from the publisher URL below, then stored as `rulebooks/<slug>.pdf`.

## air-land-and-sea-critters-at-war

- File: `rulebooks/air-land-and-sea-critters-at-war.pdf`
- Source URL: https://bgquick.com/rulebooks/air-land-sea-critters-at-war.pdf
- Source SHA-256: `f49f01bbe4be6f13150c682f218f471d98b327fb2b1c40fcf389e8bbfc55c173`
- OCR SHA-256: `a760c0b0dd7f7339952effb2cca095f129bf46e4202134d261c2b55b83cfd34e`
- Size: 2437416 bytes before, 2472733 bytes after

## brass-pittsburgh

- File: `rulebooks/brass-pittsburgh.pdf`
- Source URL: https://cdn.shopify.com/s/files/1/0246/2190/8043/files/Brass-P-Rulebook-ENG.pdf
- Source SHA-256: `22d2c6f8c2f0c65db0bb63a8fbd81c5bf314c7f5d0038feeda37f17bac06039b`
- OCR SHA-256: `fabef24ea9eecb424002afb51ec92e90de36d59941e65b75868ab18e2c5a5ace`
- Size: 12232514 bytes before, 12292356 bytes after

## cat-in-the-box-deluxe-edition

- File: `rulebooks/cat-in-the-box-deluxe-edition.pdf`
- Source URL: https://cdn.shopify.com/s/files/1/0740/4855/files/CATX_English_Online_Rules.pdf?v=1646343073
- Source SHA-256: `c196d5ed2630d97f52a6735248c8223697d95aab46997ffea6750f19a41eb33b`
- OCR SHA-256: `5b57dd31c08973140a62c91f7f6f2195e53e6d0518bc7ff588de8efaa1f255ae`
- Size: 4381238 bytes before, 4424298 bytes after

## chronicles-of-crime

- File: `rulebooks/chronicles-of-crime.pdf`
- Source URL: https://bgquick.com/rulebooks/chronicles-of-crime.pdf
- Source SHA-256: `5ec93758d83371eab3374d52e31ea465fef87dbfb69819f9930d7bcce551e3cf`
- OCR SHA-256: `0064be981543adc5fe7c07b273683e67e24dc36820a7622a33799362fbb9ec4c`
- Size: 1551927 bytes before, 1575557 bytes after

## deadwood-1876

- File: `rulebooks/deadwood-1876.pdf`
- Source URL: https://www.facadegames.com/files/rulebooks/deadwood-1876-rules-english.pdf
- Source SHA-256: `c6eec830d6d1b999c5260d19a3293e1e1d6915c72759ce76b689ea3da0b5b826`
- OCR SHA-256: `60ebeb6aee6353bfcd79271879361cdb6f570146a92096228abc1b2d64745290`
- Size: 2735209 bytes before, 2788278 bytes after

## dimension

- File: `rulebooks/dimension.pdf`
- Source URL: https://www.thamesandkosmos.com/manuals/full/692209_Dimension_Manual.pdf
- Source SHA-256: `c5fe2ed5a55917c6ee2c58b1468574bea972b1b58472e0d6360da400e568f37d`
- OCR SHA-256: `c74351319f2461d3f3798dddfffbbc80f6d97dd3ac02b99c002a3c077e66c06d`
- Size: 5704072 bytes before, 5726326 bytes after
- The publisher PDF has an empty user password. qpdf --decrypt removed that restriction before OCR. Page images match the decrypted file.

## gem

- File: `rulebooks/gem.pdf`
- Source URL: https://dl.dropboxusercontent.com/s/ba8eun7lrk9kmna/GEM_Rules_Sheet.pdf?dl=0
- Source SHA-256: `2388b2d29c5c46418281d72bddaafdebd9fd46889a12d1c53268ca5ac9c816da`
- OCR SHA-256: `ad417e84d1671b5132dada52b018066f8d9794880a0af98ba183de74b6a64938`
- Size: 4132693 bytes before, 4139212 bytes after
- The previous Rulebook field used the www.dropbox.com link. The hashed file is the `dl.dropboxusercontent.com` copy that link serves.
- The publisher PDF has an empty user password. qpdf --decrypt removed that restriction before OCR. Page images match the decrypted file.

## hive-pocket

- File: `rulebooks/hive-pocket.pdf`
- Source URL: https://bgquick.com/rulebooks/hive-pocket.pdf
- Source SHA-256: `b3f81cc13a529035857ed24c825c490856a5b3f1945bd1cb45221f4a1c01df8c`
- OCR SHA-256: `7a97528946c0d2cef936296c9c1f17d1ea36dceb005fdc4ddface63999b6c647`
- Size: 2959104 bytes before, 2977950 bytes after

## hue

- File: `rulebooks/hue.pdf`
- Source URL: https://dl.dropboxusercontent.com/s/0hmelrju09ruqcp/HUE_Rules_Sheet.pdf?dl=0
- Source SHA-256: `f36196b9688611d7d846c9d5168ffede20e40c79c58a477cc12dfbe6ef6b9815`
- OCR SHA-256: `c4fcb42baf9a462925736d276530e903cf9a5d9f3a1dd3c952c8acbee653adef`
- Size: 2913267 bytes before, 2918511 bytes after
- The previous Rulebook field used the www.dropbox.com link. The hashed file is the `dl.dropboxusercontent.com` copy that link serves.
- The publisher PDF has an empty user password. qpdf --decrypt removed that restriction before OCR. Page images match the decrypted file.

## lie

- File: `rulebooks/lie.pdf`
- Source URL: https://dl.dropboxusercontent.com/s/6bqqi6ubq20ebgo/LIE_Rules_Sheet.pdf?dl=0
- Source SHA-256: `7e017ea133520a94d1e20064d19ba0e145666acf242379de503b61db502696ec`
- OCR SHA-256: `48b3a8540ae41159b6c176483251ffd765a2b32474d5e58ff9d493648c53645c`
- Size: 2964642 bytes before, 2972947 bytes after
- The previous Rulebook field used the www.dropbox.com link. The hashed file is the `dl.dropboxusercontent.com` copy that link serves.
- The publisher PDF has an empty user password. qpdf --decrypt removed that restriction before OCR. Page images match the decrypted file.

## pan-am

- File: `rulebooks/pan-am.pdf`
- Source URL: https://bgquick.com/rulebooks/pan-am.pdf
- Source SHA-256: `b1e02245f7d69d40290c1033666c1b883dc1d8417800066452bb3cc867ee494f`
- OCR SHA-256: `c0b202129f0d2360b337421ce74c9d71b148d79dc8fabbb09cc283accc9eb90f`
- Size: 16352193 bytes before, 3179431 bytes after

## parks-second-edition

- File: `rulebooks/parks-second-edition.pdf`
- Source URL: https://cdn.shopify.com/s/files/1/1898/8501/files/Parks-2nd-Edition-1.1-Rules_Online.pdf
- Source SHA-256: `c3b96af381d09b5482af13ba3a137d1005667caa6ddcb59680bae1142ed3031c`
- OCR SHA-256: `52d0a48b01b80ea4af915105afb73eead773ea567a5c70ece5e9b860052879eb`
- Size: 18778206 bytes before, 18841566 bytes after

## ravine

- File: `rulebooks/ravine.pdf`
- Source URL: https://bgquick.com/rulebooks/ravine.pdf
- Source SHA-256: `486b3b56b00f7b7d79cade4228f3cbbe2c39dbfac6d4190f0e12b129bdd1d312`
- OCR SHA-256: `5f6081832fcbc0286b9a3a4a10f2628b9565cf8ae723549709491fc0dd1646fe`
- Size: 6825884 bytes before, 1789859 bytes after

## rebel-princess-deluxe-edition

- File: `rulebooks/rebel-princess-deluxe-edition.pdf`
- Source URL: https://cdn.shopify.com/s/files/1/0740/4855/files/RPDX_Online_Rules_Preview.pdf
- Source SHA-256: `a7bedf787cc20a5f9c6e27c59d9db5daddd52dcec6ff46eb78a7c4a7c06325d2`
- OCR SHA-256: `992ec36e2f89de47471b1ccb9736296ca14eabdb93ba7e1a48e64d33ea897d82`
- Size: 10581769 bytes before, 10648785 bytes after

## scout

- File: `rulebooks/scout.pdf`
- Source URL: https://bgquick.com/rulebooks/scout.pdf
- Source SHA-256: `66b1d252bf60fe13737cf64e0dbdaf2102c311253e3005e5b49679306445166a`
- OCR SHA-256: `b785d1cc52b8d59c16adff7cb0649fc3353ffeded80da855b1c82d7349e1d56c`
- Size: 1967294 bytes before, 1986984 bytes after

## shallow-regrets

- File: `rulebooks/shallow-regrets.pdf`
- Source URL: https://bgquick.com/rulebooks/shallow-regrets.pdf
- Source SHA-256: `19328402df262c55627916966b4c43fe5f28195989db171e75f162524f59f77e`
- OCR SHA-256: `46016d1e92304479d61d793f1320ed86991a956dbfc5e310653352adc4ce37a6`
- Size: 5214690 bytes before, 5224239 bytes after

## werewords

- File: `rulebooks/werewords.pdf`
- Source URL: https://cdn.shopify.com/s/files/1/0740/4855/files/WWRD_Online_Rules.pdf?348
- Source SHA-256: `464242f4e977438ada1991f75c227f12717f7b48016a2bce1bc91fc843249c7f`
- OCR SHA-256: `ef885fcfa28f6e5fd79a8058a1d730d5ac6f0d8e8835487eb7dcfceba563b2ed`
- Size: 1607096 bytes before, 1637271 bytes after

## wingspan

- File: `rulebooks/wingspan.pdf`
- Source URL: https://bgquick.com/rulebooks/wingspan.pdf
- Source SHA-256: `bf409041c0537729d6ce3478c3bcf437969aae9d5d3c9ada55ff9883837b0f1d`
- OCR SHA-256: `34b9fc443fe59b335b95de51c2e8673289295518233e85be7258bf92d31dce2b`
- Size: 18511066 bytes before, 18410016 bytes after
