// src/pages/AddMedicine.jsx
import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
export default function AddMedicine() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    category: '',
    salt: '',
    benefits: '',
    sideeffects: '',
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await axios.post('http://localhost:8080/new', formData);
      setFormData({
        name: '',
        price: '',
        info:'',
        working: '',
        salt: '',
        benefits: '',
        sideeffects: '',
        usage:'',
        safetyadvice:'',
      });
    navigate("/");
    } catch (err) {
      console.error(err);
      alert('Failed to add medicine.');
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Add New Medicine</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Name: </label>
          <input name="name" value={formData.name} onChange={handleChange} required />
        </div>
        <div>
          <label>Price: </label>
          <input name="price" type="number" value={formData.price} onChange={handleChange} required />
        </div>
        <div>
          <label>Info: </label>
          <input name="info" value={formData.info} onChange={handleChange} />
        </div>
        <div>
          <label>Salt: </label>
          <input name="salt" value={formData.salt} onChange={handleChange} />
        </div>
        <div>
          <label>Benefits: </label>
          <textarea name="benefits" value={formData.benefits} onChange={handleChange}></textarea>
        </div>
        <div>
          <label>Side Effects: </label>
          <textarea name="sideeffects" value={formData.sideeffects} onChange={handleChange}></textarea>
        </div>
        <div>
          <label>Usage: </label>
          <textarea name="usage" value={formData.Usage} onChange={handleChange}></textarea>
        </div>
        <div>
          <label>Side Effects: </label>
          <textarea name="working" value={formData.working} onChange={handleChange}></textarea>
        </div>
        <div>
          <label>Safety Advice: </label>
          <textarea name="safetyadvice" value={formData.safetyadvice} onChange={handleChange}></textarea>
        </div>
        <button type="submit">Add Medicine</button>
      </form>
    </div>
  );
}