window.__FINAPP_API_URL__ = window.location.protocol === "https:" || window.location.port === "3000" || window.location.port === ""
  ? `${window.location.origin}/api/v1`
  : `http://${window.location.hostname}:3001/api/v1`;

