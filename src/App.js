import React from "react";
// import logo from './logo.svg';
import "./App.css";
import PersonValidator from "./Components/PersonValidator";

function App() {
  return (
    <div className="App">
      {/* <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />        
      </header> */}
      {/* 

load models
start camera

detect face > 0.96%
detect text > 70%

check text by paterns if contains symbols like alow symbols / ' @ other symbols blacklisted

*/}
      <PersonValidator />
    </div>
  );
}

export default App;
