const API_URL = import.meta.env.VITE_API_URL;
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import './EditMedicine.css';
export default function EditMedicine() {
  const { id } = useParams(); // get medicine id from URL
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    info: '',
    category: '',
    salt: '',
    benefits: '',
    sideeffects: '',
    usage: '',
    working: '',
    safetyadvice: '',
    link:'',
    image:''
  });

  useEffect(() => {
    async function fetchMedicine() {
      try {
        const res = await axios.get(`${API_URL}/medicines/${id}`);
        console.log(res.data)
        setFormData(res.data);
      } catch (err) {
        console.error("Failed to fetch medicine:", err);
        alert("Unable to load medicine data");
      }
    }
    fetchMedicine();
  }, [id]);

  // Handle form input changes
  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // Submit edited data
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/medicines/${id}`, formData);
      alert('Medicine updated successfully!');
      navigate(`/home`);
    } catch (err) {
  console.log("Update error:", err.response?.data || err.message);
  alert('Failed to update medicine.');
}
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Edit Medicine</h2>
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
          <label>Category: </label>
          <input name="category" value={formData.category} onChange={handleChange} />
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
          <textarea name="usage" value={formData.usage} onChange={handleChange}></textarea>
        </div>
        <div>
          <label>Working: </label>
          <textarea name="working" value={formData.working} onChange={handleChange}></textarea>
        </div>
        <div>
          <label>Safety Advice: </label>
          <textarea name="safetyadvice" value={formData.safetyadvice} onChange={handleChange}></textarea>
        </div>
        <div>
          <label>Purchase URL: </label>
          <textarea name="link" value={formData.link} onChange={handleChange}></textarea>
        </div>
        <div>
          <label>Image URL: </label>
          <textarea name="image" value={formData.image} onChange={handleChange}></textarea>
        </div>
        <button type="submit">Update Medicine</button>
      </form>
    </div>
  );
}