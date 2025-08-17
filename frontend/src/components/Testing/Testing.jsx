const API_URL = import.meta.env.VITE_API_URL;
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

function Test() {
  const [medicines, setMedicines] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMedicines = async () => {
      try {
        const response = await fetch(`${API_URL}/medicines`);
        if (!response.ok) {
          throw new Error('Failed to fetch medicines');
        }
        const data = await response.json();
        setMedicines(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMedicines();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="medicines-container">
      <h1>Available Medicines</h1>
      {medicines.length === 0 ? (
        <p>No medicines found</p>
      ) : (
        <ul className="medicines-list">
          {medicines.map((med) => (
            <li key={med._id} className="medicine-item">
              <Link to={`/medicine/${med._id}`} className="medicine-link">
                {med.name} - ₹{med.price}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Test;