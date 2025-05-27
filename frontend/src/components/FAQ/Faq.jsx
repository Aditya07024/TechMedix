import React from 'react'
import './Faq.css'
const Faq = () => {
  return (
    <div className='faq'>
        <div className="faq-heading">
            <h3>Frequently asked Questions</h3>
        </div>
        <div className="faq-box">
            <div className="faq-item">
                <a href='https://www.fda.gov/drugs/frequently-asked-questions-popular-topics/generic-drugs-questions-answers#:~:text=Generic%20medicines%20and%20brand%2Dname,generic%20medicine%2C%20may%20be%20different.'>
                    <h4> Why does generic drugs look different from brand drug?</h4>
                </a>
            </div>
            <div className="faq-item">
                <a href='https://www.fda.gov/drugs/frequently-asked-questions-popular-topics/generic-drugs-questions-answers#q4'>
                    <h4>Why does generic medicine often cost less than brand medicine?</h4>
                </a>
            </div>
            <div className="faq-item">
                <a href='https://www.fda.gov/drugs/frequently-asked-questions-popular-topics/generic-drugs-questions-answers#q5'>
                    <h4>What standards must generic medicines meet to receive FDA approval?</h4>
                </a>
            </div>
            
        </div>
    </div>
  )
}

export default Faq