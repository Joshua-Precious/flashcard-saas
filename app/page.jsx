'use client';

import React from "react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-6 shadow-md">
        <div className="text-2xl font-bold"> Study Buddy</div>
        <nav className="space-x-6">
          <a href="#features" className="hover:text-blue-600">Features</a>
          <a href="#community" className="hover:text-blue-600">Community</a>
          <a href="#about" className="hover:text-blue-600">About</a>
          <button className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Get Started
          </button>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="px-8 py-20 text-center bg-gradient-to-b from-blue-50 to-white">
        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-4">
          Your Smart AI Study Companion
        </h1>
        <p className="text-lg md:text-xl text-gray-700 max-w-2xl mx-auto mb-6">
          Connect, learn, and grow with our AI-powered study tool designed for communities and individuals.
        </p>
        <a href="/study">
          <button className="px-6 py-3 bg-blue-600 text-white rounded-lg text-lg hover:bg-blue-700">
            Start Studying
          </button>
        </a>
      </section>

      {/* Features Section */}
      <section id="features" className="px-8 py-16 bg-white">
        <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div>
            <a href="/study" className="block hover:transform hover:scale-105 transition-transform duration-200">
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="font-semibold text-xl mb-2">Smart Summary</h3>
              <p className="text-gray-600">Get instant, relevant replies powered by AI.</p>
            </a>
          </div>
          <div>
            <div className="text-4xl mb-4">🌐</div>
            <h3 className="font-semibold text-xl mb-2">Quiz Generation</h3>
            <p className="text-gray-600">Create quizzes based on your study material.</p>
          </div>
          <div>
            <div className="text-4xl mb-4">🛡️</div>
            <h3 className="font-semibold text-xl mb-2">Privacy First</h3>
            <p className="text-gray-600">Your data stays secure and private.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-8 py-10 bg-gray-100 text-center text-gray-500 text-sm">
        © {new Date().getFullYear()} AI Chatbot App. All rights reserved.
      </footer>
    </div>
  );
} 