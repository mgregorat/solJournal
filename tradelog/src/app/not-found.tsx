export default function NotFound() {
    return (
      <main className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center">
        <div className="text-center space-y-6">
          <h1 className="text-6xl font-bold text-red-400 mb-4">404</h1>
          <p className="text-xl text-gray-300 mb-8">Page Not Found</p>
          <a 
            href="/" 
            className="bg-green-500 hover:bg-green-600 text-black font-semibold px-8 py-3 rounded-lg inline-block"
          >
            Go Home
          </a>
        </div>
      </main>
    );
  }