import React from 'react'
import Header from '../../components/Header/Header'
import SearchText from '../../components/SearchText/SearchText'
import SearchBar from '../../components/SearchBar/SearchBar'
import BuyProducts from '../../components/BuyProducts/BuyProducts'
import BuyProductsHeading from '../../components/BuyProductsHeading/BuyProductsHeading'
import Faq from '../../components/FAQ/Faq'
import Footer from '../../components/Footer/Footer'
import ProductDisplay from '../../components/ProductDisplay/ProductDisplay'

const Home = () => {
  return (
    <div>
        <Header />
        <SearchText/>
        <SearchBar />
        <BuyProductsHeading/>
        <BuyProducts/>
        <ProductDisplay/>
        <Faq/>
        <Footer/>
    </div>
  )
}

export default Home