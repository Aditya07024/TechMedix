# TechMedix Backend

## ML Model Setup

1. Download the Training.csv file from [Disease Prediction Dataset](https://www.kaggle.com/datasets/priyamallic/disease-prediction-using-machine-learning) and place it in the backend directory.

2. Create and activate virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate
```

3. Install requirements:

```bash
pip install -r requirements.txt
```

4. Start the ML model API:

```bash
python3 ml_model_api.py
```

5. Start the backend server:

```bash
npm run dev
```
