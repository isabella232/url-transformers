import * as L from 'monocle-ts/lib/Lens';
// TODO: remove now we have fp-ts (peer dep)
import { pipe, pipeWith } from 'pipe-ts';
import { ParsedUrlQueryInput } from 'querystring';
import * as urlHelpers from 'url';
import { getOrElseMaybe, mapMaybe } from './helpers/maybe';
import { isNonEmptyString } from './helpers/other';

interface NodeUrlObjectWithParsedQuery extends urlHelpers.UrlObject {
    query?: ParsedUrlQueryInput | null;
}

type UpdateFn<T> = (prev: T) => T;
type Update<T> = T | UpdateFn<T>;

const getPathnameFromParts = (parts: string[]) => `/${parts.join('/')}`;

const getPartsFromPathname = (pathname: string) => pathname.split('/').filter(isNonEmptyString);

const parseUrlWithQueryString = (url: string) =>
    urlHelpers.parse(
        url,
        // Parse the query string
        true,
    );

// We omit some properties since they're just serialized versions of other properties.
interface ParsedUrl
    extends Required<
        Pick<
            NodeUrlObjectWithParsedQuery,
            'auth' | 'hash' | 'hostname' | 'pathname' | 'port' | 'protocol' | 'query' | 'slashes'
        >
    > {}

const baseLens = L.id<ParsedUrl>();

const convertNodeUrl = ({
    auth,
    hash,
    hostname,
    pathname,
    port,
    protocol,
    query,
    slashes,
}: urlHelpers.UrlWithParsedQuery): ParsedUrl => ({
    auth,
    hash,
    hostname,
    pathname,
    port,
    protocol,
    query,
    slashes,
});

const parseUrl = pipe(parseUrlWithQueryString, convertNodeUrl);
const formatUrl = (parsedUrl: ParsedUrl) => urlHelpers.format(parsedUrl);

type Codec<A, IO> = {
    decode: (io: IO) => A;
    encode: (a: A) => IO;
};

const urlCodec: Codec<ParsedUrl, string> = {
    decode: parseUrl,
    encode: formatUrl,
};

type MapParsedUrlFn = (parsedUrl: ParsedUrl) => ParsedUrl;
export const mapParsedUrl = (fn: MapParsedUrlFn): MapParsedUrlFn => fn;

type MapUrlFn = (url: string) => string;
export const mapUrl = (fn: MapParsedUrlFn): MapUrlFn => pipe(urlCodec.decode, fn, urlCodec.encode);

export const replaceQueryInParsedUrl = (newQuery: Update<ParsedUrl['query']>): MapParsedUrlFn =>
    pipeWith(
        baseLens,
        L.prop('query'),
        L.modify((prev) => (typeof newQuery === 'function' ? newQuery(prev) : newQuery)),
    );

export const replaceQueryInUrl = pipe(replaceQueryInParsedUrl, mapUrl);

export const addQueryToParsedUrl = (queryToAppend: ParsedUrl['query']): MapParsedUrlFn =>
    replaceQueryInParsedUrl((prevQuery) => ({ ...prevQuery, ...queryToAppend }));

export const addQueryToUrl = pipe(addQueryToParsedUrl, mapUrl);

interface ParsedPath extends Pick<ParsedUrl, 'query' | 'pathname'> {}

const parsePath = pipe(
    parseUrlWithQueryString,
    ({ query, pathname }): ParsedPath => ({ query, pathname }),
);

const parseNullablePath = pipe(
    mapMaybe(parsePath),
    getOrElseMaybe((): ParsedPath => ({ query: null, pathname: null })),
);

const formatPath = (parsedPath: ParsedPath) => urlHelpers.format(parsedPath);

type Path = urlHelpers.Url['path'];

const pathCodec: Codec<ParsedPath, Path> = {
    decode: parseNullablePath,
    encode: formatPath,
};

const convertUpdatePathFnToUpdateParsedPathFn = (
    updatePath: UpdateFn<Path>,
): UpdateFn<ParsedPath> => pipe(pathCodec.encode, updatePath, pathCodec.decode);

const convertUpdatePathToUpdateParsedPath = (newPath: Update<Path>): Update<ParsedPath> =>
    typeof newPath === 'function'
        ? convertUpdatePathFnToUpdateParsedPathFn(newPath)
        : parseNullablePath(newPath);

export const replacePathInParsedUrl = (newPath: Update<ParsedPath>): MapParsedUrlFn =>
    pipeWith(
        baseLens,
        L.props('pathname', 'query'),
        L.modify((prev) => (typeof newPath === 'function' ? newPath(prev) : newPath)),
    );

export const replacePathInUrl = pipe(
    convertUpdatePathToUpdateParsedPath,
    replacePathInParsedUrl,
    mapUrl,
);

export const replacePathnameInParsedUrl = (
    newPathname: Update<ParsedUrl['pathname']>,
): MapParsedUrlFn =>
    pipeWith(
        baseLens,
        L.prop('pathname'),
        L.modify((prev) => (typeof newPathname === 'function' ? newPathname(prev) : newPathname)),
    );

export const replacePathnameInUrl = pipe(replacePathnameInParsedUrl, mapUrl);

export const appendPathnameToParsedUrl = (pathnameToAppend: string): MapParsedUrlFn =>
    replacePathnameInParsedUrl((prevPathname) => {
        const pathnameParts = pipeWith(
            prevPathname,
            mapMaybe(getPartsFromPathname),
            getOrElseMaybe((): string[] => []),
        );
        const pathnamePartsToAppend = getPartsFromPathname(pathnameToAppend);
        const newPathnameParts = [...pathnameParts, ...pathnamePartsToAppend];
        const newPathname = getPathnameFromParts(newPathnameParts);
        return newPathname;
    });

export const appendPathnameToUrl = pipe(appendPathnameToParsedUrl, mapUrl);

export const replaceHashInParsedUrl = (newHash: Update<ParsedUrl['hash']>): MapParsedUrlFn =>
    pipeWith(
        baseLens,
        L.prop('hash'),
        L.modify((prev) => (typeof newHash === 'function' ? newHash(prev) : newHash)),
    );

export const replaceHashInUrl = pipe(replaceHashInParsedUrl, mapUrl);
