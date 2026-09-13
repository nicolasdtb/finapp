window.__FINAPP_API_URL__ = window.location.hostname === "localhost" 
  ? "http://localhost:3001/api/v1" 
  : `http://${window.location.hostname}:3001/api/v1`;
