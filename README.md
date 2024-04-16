
## NFTのTransferをERC2771のメタトランザクションで実行するサンプル

### やってること
- Web3Authによるソーシャルログイン
- ログインしたウォレットが保有するNFTの一覧表示 (.envで指定したコントラクトアドレスのNFTが対象)
- 保有するNFTを外部へのTransferフォームの作成
- Web3Auth Providerによる署名実行
- 署名情報を受け渡したTransfer APIのコール
- Transfer API内で運営側のウォレットの秘密鍵を用い、Forwarderコントラクトに対してトランザクションを実行


- Web3Authでエンドユーザが新規ウォレットを発行し、そこにNFTを配布
- エンドユーザのウォレットにはネイティブトークンが無いため、配布されたNFTを外部にTransfer出来ない
- この問題を解決するために、NFTのコントラクトにERC2771を継承させ、運営側でGAS代を肩代わりしてTransferを実行できるようにする

### 前提
- ネットワークはSepolia
- NFTのコントラクトはERC721規格に則っていればOK
- Trusted ForwarderコントラクトはOpenZeppelinのMinimal Forwarderを想定
- Web3Authでログインしたウォレットアドレス宛にNFTをTransferしておくこと

# 動かし方
.env.exampleを参考に、.envファイルを作成する
```
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=Web3AuthのクライアントID
NEXT_PUBLIC_ALCHEMY_API_KEY=AlchemyのAPIキー (Sepoolia)
ADMIN_PRIVATE_KEY=トランザクションを実際に実行するウォレットの秘密鍵
NEXT_PUBLIC_FORWARDER_CONTRACT_ADDRESS=フォワーダーのコントラクトアドレス
NEXT_PUBLIC_ERC721_CONTRACT_ADDRESS=NFTのコントラクトアドレス
```

その後に`yarn install`と`yarn dev`で実行