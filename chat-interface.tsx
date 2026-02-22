"use client"

import { useState, type ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Home, MessageSquare, Paperclip, Plus } from "lucide-react"

export default function Component() {
  const [message, setMessage] = useState("")

  return (
    <div className="flex h-screen bg-white">
      {/* Left Sidebar */}
      <div
        className="w-16 bg-white border-r border-gray-200 flex flex-col items-center py-4 space-y-4">
        {/* Top Icons */}
        <div
          className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
          <div
            className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
            <div
              className="w-3 h-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full"></div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="w-10 h-10 bg-blue-500 text-white hover:bg-blue-600">
          <Plus className="w-5 h-5" />
        </Button>

        {/* Navigation Icons */}
        <div className="flex-1 flex flex-col space-y-2 mt-8">
          <Button
            variant="ghost"
            size="icon"
            className="w-10 h-10 text-gray-600 hover:bg-gray-100">
            <Home className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-10 h-10 text-gray-600 hover:bg-gray-100">
            <MessageSquare className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-10 h-10 text-gray-600 hover:bg-gray-100">
            <div className="w-5 h-5 rounded-full border-2 border-gray-400"></div>
          </Button>
        </div>

        {/* Bottom Icon */}
        <Button
          variant="ghost"
          size="icon"
          className="w-10 h-10 text-white bg-red-500 hover:bg-red-600 rounded-lg">
          <div className="w-6 h-6 bg-white rounded flex items-center justify-center">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
          </div>
        </Button>
      </div>
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-50 relative">
        {/* Chat Content */}
        <div className="flex-1 flex flex-col justify-center items-start px-12 pb-32">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-normal text-gray-800 mb-2">Hi Juls,</h1>
            <p className="text-xl text-gray-500">How can I help you today?</p>
          </div>
        </div>

        {/* Robot Character */}
        <div className="absolute bottom-0 right-8 w-64 h-80">
          <div className="relative w-full h-full">
            {/* 3D Robot Illustration */}
            <div className="absolute bottom-0 right-0 w-48 h-64">
              <div className="relative w-full h-full">
                {/* Robot Body */}
                <div
                  className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-16 h-24 bg-gradient-to-b from-gray-200 to-gray-300 rounded-2xl shadow-lg"></div>

                {/* Robot Head */}
                <div
                  className="absolute bottom-28 left-1/2 transform -translate-x-1/2 w-20 h-20 bg-gradient-to-b from-gray-100 to-gray-200 rounded-2xl shadow-lg">
                  {/* Eyes */}
                  <div className="absolute top-6 left-3 w-3 h-3 bg-blue-400 rounded-full"></div>
                  <div className="absolute top-6 right-3 w-3 h-3 bg-blue-400 rounded-full"></div>
                  {/* Mouth */}
                  <div
                    className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-6 h-1 bg-gray-400 rounded-full"></div>
                </div>

                {/* Robot Arms */}
                <div
                  className="absolute bottom-20 left-2 w-3 h-16 bg-gradient-to-b from-gray-200 to-gray-300 rounded-full shadow-md transform rotate-12"></div>
                <div
                  className="absolute bottom-20 right-2 w-3 h-16 bg-gradient-to-b from-gray-200 to-gray-300 rounded-full shadow-md transform -rotate-12"></div>

                {/* Robot holding red object */}
                <div
                  className="absolute bottom-16 right-0 w-4 h-6 bg-red-500 rounded shadow-md transform rotate-45"></div>

                {/* Robot Legs */}
                <div
                  className="absolute bottom-0 left-1/2 transform -translate-x-1/2 -translate-x-3 w-3 h-8 bg-gradient-to-b from-gray-200 to-gray-300 rounded-full shadow-md"></div>
                <div
                  className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-x-3 w-3 h-8 bg-gradient-to-b from-gray-200 to-gray-300 rounded-full shadow-md"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div className="p-6">
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <Input
                type="text"
                placeholder="Upload a document"
                value={message}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setMessage(e.target.value)}
                className="w-full pl-4 pr-12 py-3 bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 text-gray-400 hover:text-gray-600">
                <Paperclip className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
