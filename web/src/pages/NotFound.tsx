import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <div className="text-6xl font-bold gradient-text mb-4">404</div>
      <p className="text-white/60 mb-8">This page wandered off into the multiverse.</p>
      <Link to="/" className="btn-primary inline-flex">Go home</Link>
    </div>
  );
}
