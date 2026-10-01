import React from 'react'; import ReactDOM from 'react-dom/client'; import { BrowserRouter } from 'react-router-dom'; import App from './App'; import { AuthProvider } from './context/AuthContext'; import './styles.css';
import ToastHost from './components/ToastHost';
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><AuthProvider><App/><ToastHost/></AuthProvider></BrowserRouter></React.StrictMode>);
