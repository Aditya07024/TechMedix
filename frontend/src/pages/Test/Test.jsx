import React from 'react'
import Testing from '../../components/Testing/Testing'
import { Route } from 'react-router-dom'
import Show from '../../components/Testing/Show'


const Test = () => {
  return (
    <div>
            {/* <Route path="/test" element={<Testing />} /> */}
      {/* <Show/> */}
      <Testing/>
    </div>
  )
}

export default Test