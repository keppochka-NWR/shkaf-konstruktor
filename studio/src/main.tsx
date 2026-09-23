import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import VotanStudio from './VotanStudio';
import "./style.css";
import "./studio-refresh.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {new URLSearchParams(location.search).get('order')==='votan'?<VotanStudio/>:<App/>}
  </React.StrictMode>,
);
