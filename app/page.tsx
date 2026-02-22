'use client';

import React, { useState } from "react";

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 flex flex-wrap items-center justify-between px-4 md:px-8 py-4 md:py-6 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">Study Buddy</div>
        
        {/* Mobile Menu Button */}
        <button 
          className="md:hidden p-2 text-gray-600 hover:text-blue-600 transition-colors"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        {/* Navigation */}
        <nav className={`${isMenuOpen ? 'block' : 'hidden'} md:block w-full md:w-auto mt-4 md:mt-0 space-y-4 md:space-y-0 md:space-x-6 font-medium text-gray-600`}>
          <div className="flex flex-col md:flex-row gap-4 md:gap-6">
            <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
            <a href="#community" className="hover:text-blue-600 transition-colors">Community</a>
            <a href="#about" className="hover:text-blue-600 transition-colors">About</a>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="px-4 md:px-8 py-16 md:py-32 text-center bg-gradient-to-b from-indigo-50 via-white to-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>
        <div className="relative z-10 max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-extrabold tracking-tight text-gray-900 mb-6">
            Your Smart <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">AI Study</span> Companion
          </h1>
          <p className="text-lg md:text-xl lg:text-2xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed px-2">
            Connect, learn, and grow with our AI-powered study tool designed for communities and individuals.
          </p>
          <a href="/study" className="inline-block w-full md:w-auto">
            <button className="w-full md:w-auto px-8 py-4 bg-gray-900 text-white rounded-full text-lg font-semibold hover:bg-gray-800 hover:scale-105 transition-all duration-200 shadow-xl hover:shadow-2xl flex items-center justify-center gap-2">
              Start Studying
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
            </button>
          </a>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-4 md:px-8 py-16 md:py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-extrabold text-center mb-10 md:mb-16 text-gray-900">Why Choose Study Buddy?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10">
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm hover:shadow-xl transition-shadow duration-300 border border-gray-100">
              <a href="/study" className="block group">
                <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform duration-300">🤖</div>
                <h3 className="font-bold text-xl md:text-2xl mb-3 text-gray-900">Smart Summary</h3>
                <p className="text-gray-600 leading-relaxed text-sm md:text-base">Get instant, relevant summaries and flashcards powered by advanced AI models.</p>
              </a>
            </div>
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm hover:shadow-xl transition-shadow duration-300 border border-gray-100">
              <div className="w-16 h-16 bg-indigo-100 rounded-xl flex items-center justify-center text-3xl mb-6">🌐</div>
              <h3 className="font-bold text-xl md:text-2xl mb-3 text-gray-900">Quiz Generation</h3>
              <p className="text-gray-600 leading-relaxed text-sm md:text-base">Automatically create interactive quizzes based on your uploaded study materials.</p>
            </div>
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm hover:shadow-xl transition-shadow duration-300 border border-gray-100">
              <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center text-3xl mb-6">🛡️</div>
              <h3 className="font-bold text-xl md:text-2xl mb-3 text-gray-900">Privacy First</h3>
              <p className="text-gray-600 leading-relaxed text-sm md:text-base">Your data stays secure and private. We never share your study materials.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 md:px-8 py-8 md:py-12 bg-white border-t border-gray-100 text-center text-gray-500 text-sm">
        <p className="mb-2">© {new Date().getFullYear()} Study Buddy. All rights reserved.</p>
        <p className="text-gray-400">Empowering students with AI-driven learning.</p>
      </footer>
    </div>
  );
}
