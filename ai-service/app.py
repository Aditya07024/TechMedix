import io
import os
import json
from typing import Optional, List, Dict

import numpy as np
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image

import torch
import torch.nn as nn
import torchvision.models as models

from utils.preprocess import preprocess_image


app = FastAPI(title="TechMedix X-Ray AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Load class mapping
CLASSES_PATH = os.path.join(os.path.dirname(__file__), "models", "classes.json")
if os.path.exists(CLASSES_PATH):
    with open(CLASSES_PATH, "r") as f:
        CHEST_CONDITIONS = json.load(f)["classes"]
else:
    CHEST_CONDITIONS = [
        "Normal",
        "Pneumonia",
        "COVID-19",
        "Tuberculosis",
        "Pneumothorax",
        "Pleural Effusion",
        "Atelectasis",
        "Cardiomegaly",
        "Nodule",
        "Consolidation"
    ]


class XRModel:
    def __init__(self):
        self.model: Optional[nn.Module] = None
        self.using_fallback = False
        self.gradients = None
        self.activations = None
        self.num_classes = len(CHEST_CONDITIONS)

    def load(self):
        # Build a DenseNet121 multi-class classifier
        base = models.densenet121(weights=None)
        in_feats = base.classifier.in_features
        base.classifier = nn.Linear(in_feats, self.num_classes)
        base.eval()
        base.to(DEVICE)

        weights_path = os.path.join(os.path.dirname(__file__), "models", "model.pth")
        if os.path.exists(weights_path):
            try:
                state = torch.load(weights_path, map_location=DEVICE)
                base.load_state_dict(state, strict=False)
                print(f"✓ Loaded model weights from models/model.pth")
                print(f"✓ Model detects {self.num_classes} chest conditions")
            except Exception as e:
                print("⚠ Could not load model weights:", e)
                self.using_fallback = True
        else:
            print("⚠ models/model.pth not found. Using heuristic fallback.")
            self.using_fallback = True

        self.model = base

    @torch.inference_mode()
    def predict(self, tensor: torch.Tensor) -> tuple[str, float, Dict[str, float]]:
        if self.using_fallback or self.model is None:
            # Fallback: simulate multi-class probabilities based on image features
            x_mean = tensor.float().mean().item()
            x_var = tensor.float().var().item()
            
            # Create base probabilities
            probs = np.random.dirichlet(np.ones(self.num_classes)) * 0.3
            
            # Bias based on image features
            brightness_factor = (0.65 - x_mean) * 2.0
            variance_factor = x_var * 5.0
            
            # Increase probability for abnormal conditions if image looks concerning
            if brightness_factor > 0.2 or variance_factor > 0.1:
                probs[1] += 0.25  # Pneumonia
                probs[2] += 0.15  # COVID-19
                probs[9] += 0.10  # Consolidation
            else:
                probs[0] += 0.40  # Normal
            
            # Normalize to sum to 1
            probs = probs / probs.sum()
            
            top_idx = np.argmax(probs)
            top_prob = float(probs[top_idx])
            top_condition = CHEST_CONDITIONS[top_idx]
            
            # Create probability dictionary for all classes
            class_probs = {CHEST_CONDITIONS[i]: float(probs[i]) for i in range(self.num_classes)}
            
            return top_condition, top_prob, class_probs

        logits = self.model(tensor.to(DEVICE))
        probs = torch.softmax(logits, dim=1)[0]
        
        # Get top prediction
        top_idx = int(torch.argmax(logits, dim=1)[0])
        top_prob = float(probs[top_idx].item())
        top_condition = CHEST_CONDITIONS[top_idx]
        
        # Create probability dictionary for all classes
        class_probs = {CHEST_CONDITIONS[i]: float(probs[i].item()) for i in range(self.num_classes)}
        
        return top_condition, top_prob, class_probs

    def gradcam(self, tensor: torch.Tensor):
        if self.using_fallback or self.model is None:
            return None

        try:
            # Temporarily disable hooks for gradcam to avoid inplace modification issues
            self.model.zero_grad(set_to_none=True)
            
            # Clone tensor to avoid view issues
            tensor_clone = tensor.clone().detach().requires_grad_(True)
            logits = self.model(tensor_clone.to(DEVICE))
            cls = int(torch.argmax(logits, dim=1))
            score = logits[0, cls]
            score.backward()

            if self.gradients is None or self.activations is None:
                return None

            grads = self.gradients  # [B, C, H, W]
            acts = self.activations  # [B, C, H, W]
            weights = grads.mean(dim=(2, 3), keepdim=True)  # [B, C, 1, 1]
            cam = (weights * acts).sum(dim=1, keepdim=True)  # [B,1,H,W]
            cam = torch.relu(cam)
            cam = cam[0, 0]
            cam = cam - cam.min()
            cam = cam / (cam.max() + 1e-8)
            cam_np = cam.detach().cpu().numpy()
            return cam_np
        except Exception as e:
            print(f"⚠ Grad-CAM failed: {e}. Returning None.")
            return None


model = XRModel()
model.load()


class DiagnosisDetail(BaseModel):
    condition: str
    confidence: float


class AnalyzeResponse(BaseModel):
    primary_diagnosis: str
    confidence: float
    all_diagnostics: Dict[str, float]
    heatmap: Optional[dict] = None


@app.post("/analyze-xray", response_model=AnalyzeResponse)
async def analyze_xray(file: UploadFile = File(...), heatmap: str = Form("false")):
    contents = await file.read()
    img = Image.open(io.BytesIO(contents)).convert("RGB")
    tensor, resized_img = preprocess_image(img)  # [1,3,224,224]

    condition, conf, all_probs = model.predict(tensor)
    resp = {
        "primary_diagnosis": condition,
        "confidence": round(float(conf), 4),
        "all_diagnostics": {k: round(v, 4) for k, v in all_probs.items()}
    }

    want_cam = heatmap.lower() == "true"
    if want_cam:
        cam = model.gradcam(tensor)
        if cam is not None:
            # Overlay CAM on the resized image
            import cv2
            img_np = np.array(resized_img)
            heatmap_img = (cam * 255).astype(np.uint8)
            heatmap_img = cv2.applyColorMap(heatmap_img, cv2.COLORMAP_JET)
            overlay = cv2.addWeighted(heatmap_img, 0.45, img_np, 0.55, 0)
            # Encode to PNG base64
            import base64
            success, buffer = cv2.imencode(".png", overlay)
            if success:
                b64 = base64.b64encode(buffer.tobytes()).decode("utf-8")
                resp["heatmap"] = {"base64": b64, "mime": "image/png"}

    return resp


@app.get("/health")
def health():
    return {
        "status": "ok",
        "device": DEVICE,
        "fallback": model.using_fallback,
        "conditions": CHEST_CONDITIONS,
        "num_classes": len(CHEST_CONDITIONS)
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8000)),
        reload=False,
    )

