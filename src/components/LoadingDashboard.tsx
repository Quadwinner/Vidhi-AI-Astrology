import React, { FC} from "react";
import "./LoadingDashboard.css";
import CelestialLoader from "./CelestialLoader";

const LoadingDashboard: FC = () => {
  

  return (
    <main>
      <div className="loading-container">
        <CelestialLoader size={300} />
        <div className="loading">
          <h2 className="loading-msg">Loading Dashboard…</h2>
        </div>
      </div>
    </main>
  );
};

export default LoadingDashboard;
