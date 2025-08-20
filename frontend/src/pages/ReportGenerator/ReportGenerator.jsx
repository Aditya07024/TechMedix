import React, { useState } from 'react';
import './ReportGenerator.css';
import Header from '../../components/Header/Header';
import Footer from '../../components/Footer/Footer';

const ReportGenerator = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [report, setReport] = useState('');

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('Please select a file first!');
      return;
    }

    const formData = new FormData();
    formData.append('report', selectedFile);

    try {
      const response = await fetch('/api/upload-report', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setReport(data.aiReport);

    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error uploading file. Please try again.');
    }
  };

  return (
    <div>
      <Header />
      <div className="report-generator-container">
        <h1>Generate Health Report</h1>
        <div className="upload-section">
          <input type="file" onChange={handleFileChange} />
          <button onClick={handleUpload} disabled={!selectedFile}>Upload Report</button>
        </div>
        {report && (
          <div className="ai-report-section">
            <h2>AI Generated Report</h2>
            <p>{report}</p>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default ReportGenerator;
