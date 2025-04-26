export function GET(request) {
  console.log("GET request received");
  console.log("AssemblyAI API Key:", process.env.ASSEMBLYAI_API_KEY);
  return new Response("GET request successful", { status: 200 });
}