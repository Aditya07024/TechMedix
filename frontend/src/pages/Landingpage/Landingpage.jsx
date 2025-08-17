import React from 'react'
import { useNavigate } from 'react-router-dom';

const Landingpage = () => {
    const navigate = useNavigate();
    const useapp = () => {
        navigate("/home");
    }
    return (
        <>
            <div>Landingpage</div>
            <button onClick={useapp}>click here</button>
        </>
    )
}

export default Landingpage