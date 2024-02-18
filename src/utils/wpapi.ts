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
        console.warn( 'API err', response );
        return Promise.reject( response );
      }
      return Promise.resolve( response );
    } );
}

export function getURLForCPT( post_types: any, postType: string ) {
  const cpt = post_types.find( type => type.slug === postType );
  if( !cpt ) {
    return;
  }
  return cpt._links['wp:items'][0].href;
}

export function getWPAdminUrlForPost( data, postId ) {
  return data.site_home + '/wp-admin/post.php?post=' + postId + '&action=edit';
}

export function getWPAdminUrlForCPT( wpURL: string, postType: string ) {
  return normalizeUrl( wpURL ) + '/wp-admin/edit.php?post_type=' + postType;
}

export function normalizeUrl( url: string, protocol: string = 'http') {
  if (!/^https?:\/\//i.test(url)) {
    return protocol + '://' + url;
  }
  return url;
}