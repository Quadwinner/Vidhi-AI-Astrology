import React, { FC } from "react";
import "./LoadingPage.css";
import foot from "../assets/foot.svg";

interface LoadingPageProps {
  title?: string;      // optional title
  message?: string;    // optional message
}

const LoadingPage: FC<LoadingPageProps> = ({ title, message }) => {
  return (
    <main>
      <div className="loading-container">
        <div className="mandala-animation"></div>
        <div className="loading">
          <img src={foot} alt="loading" />
          {title && <h2 className="loading-title">{title}</h2>}
          {message && <p className="loading-msg">{message}</p>}
        </div>
      </div>
    </main>
  );
};

export default LoadingPage;

