import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

function Show() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { id } = useParams(); // Get the id parameter from the URL

    useEffect(() => {
        const fetchMedicine = async () => {
            try {
                setLoading(true);
                const response = await fetch(`http://localhost:8080/medicines/${id}`);
                if (!response.ok) {
                    throw new Error('Medicine not found');
                }
                const json = await response.json();
                setData(json);
            } catch (err) {
                setError(err.message);
                console.error('Error fetching medicine:', err);
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchMedicine();
        }
    }, [id]); // Add id as dependency

    if (loading) {
        return <div>Loading medicine details...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    if (!data) {
        return <div>No medicine found</div>;
    }

    return (
        <div className="medicine-details-container">
            <h1>Medicine Details</h1>
            <div className="medicine-info">
                <h2>{data.name}</h2>
                <p>Price: ₹{data.price}</p>
                <p>Category: {data.category}</p>
                <p>Salt: {data.salt}</p>
                <div className="medicine-description">
                    <h3>Information</h3>
                    <p>{data.info}</p>
                    <h3>Benefits</h3>
                    <p>{data.benefits}</p>
                    <h3>Side Effects</h3>
                    <p>{data.sideeffects}</p>
                    <h3>Usage</h3>
                    <p>{data.usage}</p>
                    <h3>Safety Advice</h3>
                    <p>{data.safetyadvice}</p>
                </div>
                <Link to="/medicines" className="back-button">
                    Back to Medicines
                </Link>
            </div>
        </div>
    );
}

export default Show;