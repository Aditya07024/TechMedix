"""
Setup a DenseNet121 multi-class model for chest X-ray classification.
Creates model architecture for detecting 10 different conditions.
"""
import os
import json
import torch
import torch.nn as nn
import torchvision.models as models

# Define all chest conditions
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

def download_and_setup_model():
    print("🔄 Setting up DenseNet121 multi-class model...")
    
    # Create models directory if it doesn't exist
    os.makedirs("models", exist_ok=True)
    
    # Load DenseNet121 architecture (without pre-trained weights)
    base = models.densenet121(weights=None)
    
    # Modify final layer for multi-class classification (10 conditions)
    in_features = base.classifier.in_features
    num_classes = len(CHEST_CONDITIONS)
    base.classifier = nn.Linear(in_features, num_classes)
    
    # Move to appropriate device
    device = "cuda" if torch.cuda.is_available() else "cpu"
    base.to(device)
    base.eval()
    
    # Initialize weights with better distribution
    with torch.no_grad():
        for param in base.parameters():
            if param.dim() > 1:
                nn.init.xavier_uniform_(param)
            else:
                nn.init.normal_(param, mean=0, std=0.01)
    
    # Save the model
    weights_path = os.path.join("models", "model.pth")
    torch.save(base.state_dict(), weights_path)
    
    # Save class mapping
    class_mapping_path = os.path.join("models", "classes.json")
    with open(class_mapping_path, "w") as f:
        json.dump({"classes": CHEST_CONDITIONS}, f, indent=2)
    
    print(f"✅ Multi-class model created and saved!")
    print(f"   Model: {weights_path}")
    print(f"   Classes: {class_mapping_path}")
    print(f"   Device: {device}")
    print(f"   Architecture: DenseNet121 ({num_classes} output classes)")
    print(f"\n📋 Detectable Conditions:")
    for i, condition in enumerate(CHEST_CONDITIONS, 1):
        print(f"   {i}. {condition}")
    print("\n⚠️  Note: This is a randomly initialized model for testing.")
    print("   For production, train this model on actual X-ray datasets.")

if __name__ == "__main__":
    download_and_setup_model()
