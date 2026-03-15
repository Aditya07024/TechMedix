from typing import Tuple
import torch
from torchvision import transforms
from PIL import Image


_transform = transforms.Compose(
    [
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        ),
    ]
)


def preprocess_image(img: Image.Image) -> Tuple[torch.Tensor, Image.Image]:
    """Resize to 224x224, normalize, and add batch dim.

    Returns tensor of shape [1, 3, 224, 224] and the resized PIL image.
    """
    resized = img.resize((224, 224))
    tensor = _transform(resized).unsqueeze(0)
    return tensor, resized

