import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import forwarderABI from "../../abi.json";

// フォワーダーのコントラクトアドレス
const forwarderContractAddress =
  process.env.NEXT_PUBLIC_FORWARDER_CONTRACT_ADDRESS!;

// ユーザーリストを取得するAPI
export async function POST(req: NextRequest) {
  const body = await req.json();
  const request = body;

  // ガス代を肩代わりするための運営用ウォレットのオブジェクトを生成
  const provider = new ethers.JsonRpcProvider(
    "https://ethereum-sepolia-rpc.publicnode.com"
  );

  const signer = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY!, provider);

  // Forwarderのコントラクトを生成
  const forwarder = new ethers.Contract(
    forwarderContractAddress,
    forwarderABI,
    signer
  );

  const result = await forwarder.verify(request);
  let tx;
  if (result) {
    tx = await forwarder.execute(request);
    await tx.wait(1);
  } else {
    return NextResponse.json({ error: "Invalid request" }, { status: 500 });
  }

  return NextResponse.json({ message: "Success", hash: tx.hash });
}
