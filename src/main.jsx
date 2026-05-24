import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Contacto from './Contacto.jsx'
import Portal from './Portal.jsx'

const path = window.location.pathname

let Component = App
if (path === '/contacto') Component = Contacto
else if (path.startsWith('/cliente/')) Component = Portal

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Component />
  </React.StrictMode>
)
