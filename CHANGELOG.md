## [0.7.0](https://github.com/RyanGarber/tiny-chat/compare/0.6.4...0.7.0) (2026-07-28)

### ⚠ BREAKING CHANGES

* redesigned tools, providers, and settings

### Features

* improved model performance ([ea48c77](https://github.com/RyanGarber/tiny-chat/commit/ea48c77a337b325bc27a0786d2dad5a67fc886c3-1))
* slash commands and attachments ([ea48c77](https://github.com/RyanGarber/tiny-chat/commit/ea48c77a337b325bc27a0786d2dad5a67fc886c3))
* tool prefixes for naming conflicts ([ea48c77](https://github.com/RyanGarber/tiny-chat/commit/ea48c77a337b325bc27a0786d2dad5a67fc886c3-4))

### Bug Fixes

* some models not recognizing tool schema ([ea48c77](https://github.com/RyanGarber/tiny-chat/commit/ea48c77a337b325bc27a0786d2dad5a67fc886c3-5))

### Code Refactoring

* redesigned tools, providers, and settings ([ea48c77](https://github.com/RyanGarber/tiny-chat/commit/ea48c77a337b325bc27a0786d2dad5a67fc886c3-3))


## [0.6.4](https://github.com/RyanGarber/tiny-chat/compare/0.6.3...0.6.4) (2026-07-10)

### Bug Fixes

* potential error when stringifying log data ([cae8ed0](https://github.com/RyanGarber/tiny-chat/commit/cae8ed0339e4ef3a8c15d4c2e1473a99e7e41f8f-1))
* rolldown code splitting causing silent runtime fail ([cae8ed0](https://github.com/RyanGarber/tiny-chat/commit/cae8ed0339e4ef3a8c15d4c2e1473a99e7e41f8f))


## [0.6.3](https://github.com/RyanGarber/tiny-chat/compare/0.6.2...0.6.3) (2026-07-10)

### Features

* automatic syntax highlighting in chat input ([fc03fb2](https://github.com/RyanGarber/tiny-chat/commit/fc03fb2532407c2e36567448660382bb3fe49f1a))
* best-effort decoding of files ([fc03fb2](https://github.com/RyanGarber/tiny-chat/commit/fc03fb2532407c2e36567448660382bb3fe49f1a-1))
* fuzzy matching of web references ([fc03fb2](https://github.com/RyanGarber/tiny-chat/commit/fc03fb2532407c2e36567448660382bb3fe49f1a-2))
* improved tables, refs, code blocks, and diffs ([f15eac6](https://github.com/RyanGarber/tiny-chat/commit/f15eac671542dfca05cfb3cc35353f010f62cc67))
* rich text editing ([610a607](https://github.com/RyanGarber/tiny-chat/commit/610a60752ab9379c31fe675d04d3669ac30b3fab))

### Bug Fixes

* bash commands returning wrong folder contents for basePath ([fc03fb2](https://github.com/RyanGarber/tiny-chat/commit/fc03fb2532407c2e36567448660382bb3fe49f1a-4))
* incorrect width when diff lines are collapsed ([f15eac6](https://github.com/RyanGarber/tiny-chat/commit/f15eac671542dfca05cfb3cc35353f010f62cc67-3))
* non-standard whitespace accepted in filenames ([fc03fb2](https://github.com/RyanGarber/tiny-chat/commit/fc03fb2532407c2e36567448660382bb3fe49f1a-3))
* selected code theme ignored by streamdown ([f15eac6](https://github.com/RyanGarber/tiny-chat/commit/f15eac671542dfca05cfb3cc35353f010f62cc67-4))

### Performance Improvements

* optimized component rendering ([f15eac6](https://github.com/RyanGarber/tiny-chat/commit/f15eac671542dfca05cfb3cc35353f010f62cc67-2))


## [0.6.2](https://github.com/RyanGarber/tiny-chat/compare/0.6.1...0.6.2) (2026-07-07)

### Bug Fixes

* selectable file preview not working for text uploads ([86118da](https://github.com/RyanGarber/tiny-chat/commit/86118daf4c59ab3f71ddb1f5462d151176ae11c1))


## [0.6.1](https://github.com/RyanGarber/tiny-chat/compare/0.6.0...0.6.1) (2026-07-06)

### Bug Fixes

* <message> tags not scrubbed from prompt ([fa46bc5](https://github.com/RyanGarber/tiny-chat/commit/fa46bc57dbc6232ef96e724ae55f4eefdaf2eaae-2))
* diff not rendering for local write_file calls ([fa46bc5](https://github.com/RyanGarber/tiny-chat/commit/fa46bc57dbc6232ef96e724ae55f4eefdaf2eaae-5))
* large text files not saving to db ([fa46bc5](https://github.com/RyanGarber/tiny-chat/commit/fa46bc57dbc6232ef96e724ae55f4eefdaf2eaae-4))
* mismatched file embedding and inclusion logic ([fa46bc5](https://github.com/RyanGarber/tiny-chat/commit/fa46bc57dbc6232ef96e724ae55f4eefdaf2eaae-1))
* repo clone fails due to bug in bun ([fa46bc5](https://github.com/RyanGarber/tiny-chat/commit/fa46bc57dbc6232ef96e724ae55f4eefdaf2eaae))
* some text wrongly scrubbed from prompt ([fa46bc5](https://github.com/RyanGarber/tiny-chat/commit/fa46bc57dbc6232ef96e724ae55f4eefdaf2eaae-3))
