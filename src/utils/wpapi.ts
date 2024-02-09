import {encode } from 'base-64'

export function authenticadedFetch( url: string, params = {}, username: string, password: string ) {
    const args = {
      ...params,
      headers: {
        'Authorization': 'Basic ' + encode( username + ':' + password ),
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }
    return fetch( url, args ).then((response) => response.json()).then( response => {
      if ( response.code ) {
        return Promise.reject( response );
      }
      return Promise.resolve( response );
    } );
  }