import React from 'react';
import { Link } from 'react-router-dom';
import "./notfound.css"

const notfound = () => {
  return (
    <div className="notfound-page">
      <div className="text-section">
        <h1 className=''>Ooops...</h1>
        <h2>Sorry, we can't find that page</h2>
        <Link to="/home">← Back</Link>
      </div>
      <div className="video-section">
        <video autoPlay loop muted playsInline style={{ maxWidth: "700px" }}>
          <source src="../src/assets/not-found.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  );
};

export default notfound;