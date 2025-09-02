import React from 'react'
import Header from '../../components/Header/Header'
import SearchText from '../../components/SearchText/SearchText'
import SearchBar from '../../components/SearchBar/SearchBar'
import BuyProducts from '../../components/BuyProducts/BuyProducts'
import BuyProductsHeading from '../../components/BuyProductsHeading/BuyProductsHeading'
import Faq from '../../components/FAQ/Faq'
import Footer from '../../components/Footer/Footer'
import ProductDisplay from '../../components/ProductDisplay/ProductDisplay'
import './Home.css'


const Home = () => {
  return (
    <div className="all-div">
        <Header />
        <SearchText/>
        <SearchBar />
{/*         <div classname="report-button"><button className="report-generator-button" onClick={() => window.location.href='/report-generator'}>Report Generator</button></div> */}
        <BuyProductsHeading/>
        <BuyProducts/>
        <ProductDisplay/>
        <Faq/>
        <Footer/>
    </div>
  )
}

export default Home
