// Simple test script to verify QR code generation
import QRCode from "qrcode";

async function testQRGeneration() {
  try {
    const testUniqueId = "TEST123";
    console.log("Testing QR code generation with unique ID:", testUniqueId);
    
    const qrCodeImage = await QRCode.toDataURL(testUniqueId, {
      width: 200,
      margin: 2,
      errorCorrectionLevel: "L",
    });
    
    console.log("✅ QR code generated successfully!");
    console.log("QR code data URL length:", qrCodeImage.length);
    console.log("QR code starts with:", qrCodeImage.substring(0, 50) + "...");
    
    // Test decoding (simulation)
    console.log("\n📱 Simulated QR scan result:", testUniqueId);
    
  } catch (error) {
    console.error("❌ Error generating QR code:", error);
  }
}

testQRGeneration();
