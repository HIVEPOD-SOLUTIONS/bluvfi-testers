import { createRoot } from "react-dom/client";
import { createThirdwebClient } from "thirdweb";
import { ThirdwebProvider } from "thirdweb/react";
import App from "./App.tsx";
import { BluvfiTestersPage } from "./pages/BluvfiTestersPage";
import { NotificationProvider } from "./contexts/NotificationContext.tsx";
import "./index.css";

const client = createThirdwebClient({
  clientId: "c0016c054a796a6fa54b18dd24ed5f77",
});

const pathname = window.location.pathname;

// Show tester page at "/", "/bluvfi-testers", and "/bluvfi-testers/"
const showTesterPage =
  pathname === "/" ||
  pathname === "/bluvfi-testers" ||
  pathname === "/bluvfi-testers/";

createRoot(document.getElementById("root")!).render(
  <ThirdwebProvider>
    <NotificationProvider>
      {showTesterPage ? (
        <BluvfiTestersPage />
      ) : (
        <App thirdwebClient={client} />
      )}
    </NotificationProvider>
  </ThirdwebProvider>
);