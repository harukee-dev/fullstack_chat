import { useState } from 'react'
import searchIcon from './images/search-icon.svg'
import cl from './searchButton.module.css'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '../../store'
import { setValue } from '../../slices/searchMessageSlice'

export const SearchButton = () => {
  const dispatch = useDispatch<AppDispatch>()

  const onEnter = (event: any) => {
    if (event.key === 'Enter') {
      dispatch(setValue(event.target.value))
    }
  }

  return (
    <input
      onKeyDown={(event) => onEnter(event)}
      placeholder="search"
      className={cl.input}
      type="text"
    />
  )
}
