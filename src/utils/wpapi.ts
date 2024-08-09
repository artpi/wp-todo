import { encode } from 'base-64';

export function authenticadedFetch(
	url: string,
	params: Record< string, any > = {},
	username: string,
	password: string
): Promise< any > {
	const args = {
		...params,
		headers: {
			Authorization: 'Basic ' + encode( username + ':' + password ),
			'Content-Type': 'application/json',
			Accept: 'application/json',
		},
	};
	return fetch( url, args )
		.then( ( response ) => response.json() )
		.then( ( response ) => {
			if ( response.code ) {
				console.warn( 'API err', response );
				return Promise.reject( response );
			}
			return Promise.resolve( response );
		} );
}

interface PostType {
	slug: string;
	_links: {
		'wp:items': Array< { href: string } >;
	};
}

export function getURLForCPT(
	post_types: PostType[],
	postType: string
): string | undefined {
	const cpt = post_types.find( ( type ) => type.slug === postType );
	if ( ! cpt ) {
		return undefined;
	}
	return cpt._links[ 'wp:items' ][ 0 ].href;
}

export function getWPAdminUrlForPost(
	data: { site_home: string },
	postId: number | string
): string {
	return `${ data.site_home }/wp-admin/post.php?post=${ postId }&action=edit`;
}

export function getWPAdminUrlForCPT( wpURL: string, postType: string ): string {
	return `${ normalizeUrl(
		wpURL
	) }/wp-admin/edit.php?post_type=${ postType }`;
}

export function normalizeUrl( url: string, protocol: string = 'http' ): string {
	if ( ! /^https?:\/\//i.test( url ) ) {
		return `${ protocol }://${ url }`;
	}
	return url;
}

export function getPagePromise(
  url: string,
  page: number,
  status: string | null,
  previousData: [],
  login: string,
  pass: string
): Promise<[]> {
  const modifiedURL = new URL( url );
  modifiedURL.searchParams.set( 'per_page', '100' );
  modifiedURL.searchParams.set( 'context', 'edit' );
  modifiedURL.searchParams.set( 'page', page.toString() );
  if ( status ) {
    modifiedURL.searchParams.set( 'status', status );
  }
  return authenticadedFetch(
    modifiedURL.toString(),
    {},
    login,
    pass
  ).then( ( response ) => {
    const data = previousData.concat( response );
    if ( response.length < 100 ) {
      // All results
      return Promise.resolve( data );
    } else {
      return getPagePromise( url, page + 1, status, data, login, pass );
    }
  } );
}