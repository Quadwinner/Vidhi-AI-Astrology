import React, { FC } from "react";
import "./LoadingPage.css";
import CelestialLoader from "./CelestialLoader";

interface LoadingPageProps {
  title?: string;      // optional title
  message?: string;    // optional message
}

const LoadingPage: FC<LoadingPageProps> = ({ title, message }) => {
  return (
    <main>
      <div className="loading-container">
        <CelestialLoader size={300} />
        <div className="loading">
          {title && <h2 className="loading-title">{title}</h2>}
          <p className="loading-msg">{message || 'Aligning the stars…'}</p>
        </div>
      </div>
    </main>
  );
};

export default LoadingPage;

