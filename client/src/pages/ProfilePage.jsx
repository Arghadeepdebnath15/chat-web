import React, { useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import assets from '../assets/assets';
import { AuthContext } from '../../context/AuthContext';

const ProfilePage = () => {

  const {authUser, updateProfile} = useContext(AuthContext)

  const [selectedImg, setSelectedImg] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate();
  const [name, setName] = useState(authUser.fullName)
  const [bio, setBio] = useState(authUser.bio)

  const handleSubmit = async (e)=>{
    e.preventDefault();
    setIsLoading(true);

    try {
      if(!selectedImg){
        await updateProfile({fullName: name, bio});
        navigate('/');
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(selectedImg);
      reader.onload = async ()=>{
        const base64Image = reader.result;
        await updateProfile({profilePic: base64Image, fullName: name, bio});
        navigate('/');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-2 sm:p-4'>
      <div className='w-full max-w-4xl'>
        {/* Header */}
        <div className='text-center mb-6 sm:mb-8'>
          <h1 className='text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent mb-2'>
            Edit Profile
          </h1>
          <p className='text-gray-400 text-sm sm:text-base lg:text-lg px-4'>Customize your profile to make it uniquely yours</p>
        </div>

        {/* Main Profile Card */}
        <div className='backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-2xl overflow-hidden'>
          <div className='flex flex-col lg:flex-row'>
            {/* Profile Image Section */}
            <div className='lg:w-1/3 bg-gradient-to-br from-purple-600/20 to-pink-600/20 p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-center relative'>
              <div className='relative group'>
                <div className='absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-300'></div>
                <img
                  className='relative w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 rounded-full object-cover border-4 border-white/20 shadow-2xl transition-transform duration-300 hover:scale-105'
                  src={selectedImg ? URL.createObjectURL(selectedImg) : (authUser?.profilePic || assets.logo_icon)}
                  alt="Profile"
                />
                <div className='absolute bottom-1 right-1 sm:bottom-2 sm:right-2 w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg'>
                  <svg className='w-3 h-3 sm:w-4 sm:h-4 text-white' fill='currentColor' viewBox='0 0 20 20'>
                    <path fillRule='evenodd' d='M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z' clipRule='evenodd'/>
                  </svg>
                </div>
              </div>
              <p className='text-white/80 text-xs sm:text-sm mt-3 sm:mt-4 text-center px-2'>Click to upload a new profile picture</p>
            </div>

            {/* Form Section */}
            <div className='lg:w-2/3 p-4 sm:p-6 lg:p-8'>
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                <div className='space-y-2'>
                  <label className='text-white text-sm font-medium block'>Full Name</label>
                  <div className='relative'>
                    <input
                      onChange={(e)=>setName(e.target.value)}
                      value={name}
                      type="text"
                      required
                      placeholder='Enter your full name'
                      className='w-full p-3 sm:p-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 backdrop-blur-sm text-sm sm:text-base'
                    />
                    <svg className='absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-white/50' fill='currentColor' viewBox='0 0 20 20'>
                      <path fillRule='evenodd' d='M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z' clipRule='evenodd'/>
                    </svg>
                  </div>
                </div>

                <div className='space-y-2'>
                  <label className='text-white text-sm font-medium block'>Bio</label>
                  <div className='relative'>
                    <textarea
                      onChange={(e)=>setBio(e.target.value)}
                      value={bio}
                      placeholder="Tell us about yourself..."
                      required
                      rows={3}
                      className='w-full p-3 sm:p-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 backdrop-blur-sm resize-none text-sm sm:text-base'
                    />
                    <svg className='absolute right-3 sm:right-4 top-3 sm:top-4 w-4 h-4 sm:w-5 sm:h-5 text-white/50' fill='currentColor' viewBox='0 0 20 20'>
                      <path fillRule='evenodd' d='M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z' clipRule='evenodd'/>
                    </svg>
                  </div>
                </div>

                <div className='space-y-2'>
                  <label className='text-white text-sm font-medium block'>Profile Picture</label>
                  <label htmlFor="avatar" className='flex items-center gap-2 sm:gap-3 cursor-pointer group'>
                    <input
                      onChange={(e)=>setSelectedImg(e.target.files[0])}
                      type="file"
                      id='avatar'
                      accept='.png, .jpg, .jpeg'
                      hidden
                    />
                    <div className='flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition-all duration-200 group-hover:border-purple-400/50 w-full'>
                      <div className='w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0'>
                        <svg className='w-5 h-5 sm:w-6 sm:h-6 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12'/>
                        </svg>
                      </div>
                      <div className='min-w-0 flex-1'>
                        <p className='text-white font-medium text-sm sm:text-base truncate'>Upload new profile picture</p>
                        <p className='text-white/60 text-xs sm:text-sm'>PNG, JPG up to 10MB</p>
                      </div>
                    </div>
                  </label>
                </div>

                <div className='flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4'>
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className='flex-1 p-3 sm:p-4 bg-white/10 border border-white/20 text-white rounded-xl hover:bg-white/20 transition-all duration-200 font-medium text-sm sm:text-base'
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className='flex-1 p-3 sm:p-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base'
                  >
                    {isLoading ? (
                      <>
                        <svg className='animate-spin w-4 h-4 sm:w-5 sm:h-5' fill='none' viewBox='0 0 24 24'>
                          <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4'/>
                          <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'/>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className='w-4 h-4 sm:w-5 sm:h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7'/>
                        </svg>
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className='mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4'>
          <div className='backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6 text-center'>
            <div className='text-xl sm:text-2xl font-bold text-purple-400 mb-1 sm:mb-2'>Profile</div>
            <div className='text-white/60 text-xs sm:text-sm'>Complete</div>
          </div>
          <div className='backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6 text-center'>
            <div className='text-xl sm:text-2xl font-bold text-pink-400 mb-1 sm:mb-2'>Active</div>
            <div className='text-white/60 text-xs sm:text-sm'>Status</div>
          </div>
          <div className='backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6 text-center sm:col-span-2 lg:col-span-1'>
            <div className='text-xl sm:text-2xl font-bold text-red-400 mb-1 sm:mb-2'>Secure</div>
            <div className='text-white/60 text-xs sm:text-sm'>Account</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage
