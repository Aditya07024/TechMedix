import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doctorPosterApi } from '../../api';
import './Header.css';

const Header = () => {
  const navigate = useNavigate();
  const [slides, setSlides] = useState([
    {
      isDefault: true,
      image: '/header_img.png',
      title: 'Your Health, Our Priority',
      subtitle: 'All your healthcare data one scan away.'
    }
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    async function loadActivePosters() {
      try {
        const res = await doctorPosterApi.getActivePosters();
        if (res.data?.success && res.data.data?.length > 0) {
          const activeSlides = res.data.data.map(poster => ({
            isDefault: false,
            image: poster.image_url,
            doctor_name: poster.doctor_name,
            specialty: poster.specialty,
            doctor_id: poster.doctor_id
          }));
          
          setSlides(prev => [prev[0], ...activeSlides]);
        }
      } catch (err) {
        console.warn('Failed to load active banners:', err);
      }
    }
    loadActivePosters();
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % slides.length);
    }, 1000); // cycle every 1 second (1 sec 1 poster)

    return () => clearInterval(interval);
  }, [slides]);

  const handleSlideClick = (slide) => {
    if (slide.isDefault) {
      navigate('/search');
    } else {
      navigate('/dashboard', { state: { bookDoctorId: slide.doctor_id } });
    }
  };

  return (
    <div className="header-slider-container">
      {slides.map((slide, index) => {
        const isActive = index === currentIndex;
        return (
          <div
            key={index}
            className={`header-slide ${isActive ? 'active' : ''}`}
            style={{
              backgroundImage: `linear-gradient(#00de9444, rgba(0, 0, 0, 0.45)), url(${slide.image})`
            }}
          >
            {slide.isDefault ? (
              <div className="header-contents">
                <h2>{slide.title}</h2>
                <p>{slide.subtitle}</p>
                <button 
                  className="header-cta-btn" 
                  onClick={() => navigate('/search')}
                >
                  Search Medicines
                </button>
              </div>
            ) : (
              <div className="header-contents promoted-doctor-contents">
                <span className="promoted-badge">Featured Specialist</span>
                <h2>Dr. {slide.doctor_name}</h2>
                <p>{slide.specialty}</p>
                <button
                  className="header-cta-btn promoted-cta"
                  onClick={() => navigate('/dashboard')}
                >
                  Book Appointment Now
                </button>
              </div>
            )}
          </div>
        );
      })}

      {slides.length > 1 && (
        <div className="slider-dots">
          {slides.map((_, index) => (
            <span
              key={index}
              className={`dot ${index === currentIndex ? 'active' : ''}`}
              onClick={() => setCurrentIndex(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Header;