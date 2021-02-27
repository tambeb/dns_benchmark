'use strict';

const path = require( 'path' );
const fs = require( 'fs-extra' );
const root = path.resolve();
const https = require( 'https' );
const dnsPacket = require( 'dns-packet' );
const { execSync } = require( 'child_process' );
const syncRequest = require( 'sync-request' );

var settings = openJsonSync( 'benchmark_settings.json' );
const protocols = Object.keys( settings.commands );
const categories = settings.domains;
const targets = settings.targets.reduce( ( acc, item ) => {
    acc.push( item.id );
    return acc;
}, [] );
var outputFileTemplate = settings.outputFileTemplate;

process.on( 'warning', ( warning ) => { console.log( warning ); } );
process.on( 'unhandledRejection', ( reason, promise ) => { console.log( reason ); console.log( promise ); } );
process.on( 'uncaughtException', ( err ) => { console.log( err ); } );

let args = {
    protocol: null,
    category: null,
    target: null,
    targetData: [],
    domainList: {}
};

process.argv.slice( 2 ).map( item => {
    if ( item.includes( '=' ) ) {
        let temp = item.split( '=' );
        args[ temp[ 0 ].toLowerCase() ] = temp[ 1 ].toLowerCase().split( ',' );
    }
    else if ( item.includes( '?' ) || item.toLowerCase().includes( 'help' ) ) {
        console.log( `Usage: node benchmark protocol=PROTOCOL[,PROTOCOL] category=CATEGORY[,CATEGORY] target=TARGET[,TARGET]` );
        console.group( 'protocol' );
        console.log( `Comma separated list of one or more of: ${ protocols }` );
        console.groupEnd();

        console.group( 'category' );
        console.log( `Comma separated list of one or more of: ${ Object.keys( categories ) }` );
        console.groupEnd();

        console.group( 'target' );
        console.log( `Comma separated list of one or more of: ${ targets }` );
        console.groupEnd();
        process.exit();
    }
    else {
        console.log( `Please specify what ${ item } is` );
        process.exit();
    }
} );

args.targetData = settings.targets.filter( item => {
    return args.target.includes( item.id.toLowerCase() );
} );

args.category.map( item => {
    args.domainList[ item ] = settings.domains[ item ];
} );

var average = ( arr ) => {
    if ( Array.isArray( arr ) ) {
        if ( arr.length > 0 ) {
            let count = 1;
            let total = arr.reduce( ( a, b ) => {
                count++;
                return a + b;
            } );
            return total / count;
        }
        else {
            return 0;
        }
    }
    else {
        return 0;
    }
};
var product = ( arr ) => {
    if ( Array.isArray( arr ) ) {
        if ( arr.length > 0 ) {
            let prod = arr.reduce( ( a, b ) => {
                return a * b;
            } );
            return prod;
        }
        else {
            return 0;
        }
    }
    else {
        return 0;
    }
};
function dohRequest( data ) {
    let start = Date.now();
    let res = syncRequest( 'POST', data.url,
        {
            headers: {
                'Content-Type': 'application/dns-message',
                'Content-Length': Buffer.byteLength( data.dns )
            },
            body: data.dns
        }
    );
    res = dnsPacket.decode( res.body );
    let timing = Date.now() - start;
    if ( parseDohResponse( res ) ) {
        return { timing: timing };
    }
    else {
        return { timing: false };
    }
}
function execCmdSync( cmd, type ) {
    let start = Date.now();
    let final = execSync( cmd, { encoding: 'utf8' } );
    let timing = Date.now() - start;
    if ( type == 'dot' ) {
        if ( parsegetDnsQueryResponse( final ) ) {
            return { timing: timing };
        }
        else {
            return { timing: false };
        }
    }
    else if ( type.includes( 'dns' ) ) {
        if ( parseDigResponse( final ) ) {
            return { timing: timing };
        }
        else {
            return { timing: false };
        }
    }
}
function generateCmd( data, template ) {
    let url = data.url;
    let server = data.server;
    let hostname = data.hostname;
    let cmd;
    cmd = eval( '`' + template + '`' );
    return cmd;
}
function parseDohResponse( data ) {
    let value = data.rcode || data.Status;
    try {
        if ( value == 'NOERROR' || value == 'NXDOMAIN' || value == 0 | value == 3 ) {
            return true;
        }
        else {
            return false;
        }
    }
    catch ( err ) {
        return false;
    }
}
function parsegetDnsQueryResponse( data ) {
    let status;
    try {
        status = JSON.parse( data ).status;
        if ( status == 900 || status == 901 ) {
            return true;
        }
        else {
            return false;
        }
    }
    catch ( err ) {
        return false;
    }
}
function parseDigResponse( data ) {
    let start = data.indexOf( 'status' );
    let status = data.slice( start, data.indexOf( ',', start ) ).replace( 'status:', '' );
    status = status.trim();
    if ( status == 'NOERROR' || status == 'NXDOMAIN' ) {
        return true;
    }
    else {
        return false;
    }
}
function openJsonSync( fileName ) {
    let file = path.join( root, fileName );
    fs.ensureFileSync( file );
    return fs.readJsonSync( file );
}
function saveFile( fileName, data, filePath = [ root ] ) {
    return new Promise( function ( resolve, reject ) {
        let file = path.join( ...filePath, fileName );
        fs.writeFile( file, data ).then( () => {
            resolve();
        } ).catch( err => {
            reject( err );
        } );
    } );
}
function openFile( fileName, filePath = [ root ] ) {
    return new Promise( function ( resolve, reject ) {
        let file = path.join( ...filePath, fileName );
        fs.readFile( file, 'utf8' ).then( data => {
            resolve( data );
        } ).catch( err => {
            reject( err );
        } );
    } );
}
function appendNewLine( data, fileName, filePath ) {
    return new Promise( function ( resolve, reject ) {
        let file = path.join( ...filePath, fileName );
        fs.appendFileSync( file, data + '\n' );
    } );
}
function pad( num ) {
    if ( typeof num == 'string' ) {
        if ( num.length < 2 ) {
            num = '0' + num;
        }
        return num;
    }
    else if ( typeof num == 'number' ) {
        num = num.toFixed( 0 );
        if ( num.length < 2 ) {
            num = '0' + num;
        }
        return num;
    }
}
function getMediumTimeAP( ms ) {
    if ( ms == undefined ) {
        var mediumTime = new Date();
    }
    else {
        var mediumTime = new Date( ms );
    }
    var eventHour = mediumTime.getHours();
    var eventMinute = mediumTime.getMinutes();
    var eventSecond = mediumTime.getSeconds();
    if ( eventHour > 12 ) {
        eventHour = eventHour - 12;
        mediumTime = pad( eventHour ) + ':' + pad( eventMinute ) + ':' + pad( eventSecond ) + 'p';
    }
    else if ( eventHour == 0 ) {
        eventHour = 12;
        mediumTime = pad( eventHour ) + ':' + pad( eventMinute ) + ':' + pad( eventSecond ) + 'a';
    }
    else if ( eventHour == 12 ) {
        mediumTime = pad( eventHour ) + ':' + pad( eventMinute ) + ':' + pad( eventSecond ) + 'p';
    }
    else {
        mediumTime = pad( eventHour ) + ':' + pad( eventMinute ) + ':' + pad( eventSecond ) + 'a';
    }
    return mediumTime;
}
function getYYYYMMDDHHMMSSTime( ms ) {
    if ( ms == undefined ) {
        var time = new Date();
    }
    else {
        var time = new Date( ms );
    }
    var eventMonth = pad( time.getMonth() + 1 );
    var eventDay = pad( time.getDate() );
    var eventYear = time.getFullYear();
    var eventHour = pad( time.getHours() );
    var eventMinute = pad( time.getMinutes() );
    var eventSecond = pad( time.getSeconds() );
    return `${ eventYear }${ eventMonth }${ eventDay }_${ eventHour }${ eventMinute }${ eventSecond }`;
}
var runCounter = function ( total ) {
    let current = 0;
    function increment() {
        current += 1;
    };
    return {
        count: function () {
            increment();
            return `${ current }/${ total }`;
        }
    };
};
var getRandomInt = function () {
    return Math.floor( Math.random() * ( 65534 - 1 + 1 ) ) + 1;
};

let factors = [];
factors.push( args.category.reduce( ( sum, item ) => {
    sum += args.domainList[ item ].length;
    return sum;
}, 0 ) );
factors.push( args.target.length );
factors.push( args.protocol.length );
let counterOverall = runCounter( product( factors ) );
let timestamp = getYYYYMMDDHHMMSSTime();
let outputFileName = eval( '`' + outputFileTemplate + '`' );
let summary = ( args.protocol.reduce( ( summaryProtocol, protocol ) => {
    switch ( protocol ) {
        case 'doh':
            summaryProtocol.push( args.category.reduce( ( summaryDomain, category ) => {
                summaryDomain.push( args.targetData.reduce( ( summaryTarget, target ) => {
                    let id = target.id;
                    let server = target.doh.reduce( ( acc, item ) => {
                        acc += item == 'hostname' ? `${ target[ item ] }.` : ( item == 'path' ? `/${ target[ item ] }` : target[ item ] );
                        return acc;
                    }, '' );
                    let counter = runCounter( args.domainList[ category ].length );
                    summaryTarget.push( args.domainList[ category ].reduce( ( summarySite, site ) => {
                        let dns = dnsPacket.encode( {
                            type: 'query',
                            id: getRandomInt(),
                            flags: dnsPacket.RECURSION_DESIRED,
                            questions: [ {
                                type: 'A',
                                name: site
                            } ]
                        } );
                        let cmdResult = dohRequest( { url: `https://${ server }`, dns: dns } );
                        let result = `${ id },${ protocol },${ category },${ site },${ cmdResult.timing }`;
                        appendNewLine( result, `${ outputFileName }.csv`, [ root ] );
                        console.log( `${ counterOverall.count() } ${ counter.count() }: ${ result }` );
                        summarySite.push( {
                            protocol: protocol,
                            id: id,
                            category: category,
                            domain: site,
                            time: cmdResult.timing
                        } );
                        return summarySite;
                    }, [] ) );
                    return summaryTarget;
                }, [] ) );
                return summaryDomain;
            }, [] ) );
            return summaryProtocol;
            break;
        case 'dns':
        case 'dnstcp':
        case 'dot':
            summaryProtocol.push( args.category.reduce( ( summaryDomain, category ) => {
                summaryDomain.push( args.targetData.reduce( ( summaryTarget, target ) => {
                    let command = settings.commands[ protocol ];
                    let id = target.id;
                    let dot = false || target.dot;
                    let server = dot ? dot : target.server;
                    let hostname = dot ? "" : target.hostname;
                    let counter = runCounter( args.domainList[ category ].length );
                    summaryTarget.push( args.domainList[ category ].reduce( ( summarySite, site ) => {
                        let cmdResult = execCmdSync( generateCmd( { url: site, server: server, hostname: hostname }, command ), protocol );
                        let result = `${ id },${ protocol },${ category },${ site },${ cmdResult.timing }`;
                        appendNewLine( result, `${ outputFileName }.csv`, [ root ] );
                        console.log( `${ counterOverall.count() } ${ counter.count() }: ${ result }` );
                        summarySite.push( {
                            protocol: protocol,
                            id: id,
                            category: category,
                            domain: site,
                            time: cmdResult.timing
                        } );
                        return summarySite;
                    }, [] ) );
                    return summaryTarget;
                }, [] ) );
                return summaryDomain;
            }, [] ) );
            return summaryProtocol;
            break;
        default:
            console.log( `Unknown protocol: ${ protocol }` );
            return summaryProtocol;
    }
}, [] ) ).flat( Infinity );

saveFile( `${ outputFileName }.json`, JSON.stringify( summary ) );

console.log( '\n' );
console.log( `average query response times( lower is better )` );

args.protocol.map( protocol => {
    console.log( `protocol: ${ protocol }` );
    let timesCategory = {};
    timesCategory[ 'overall' ] = {};
    args.target.map( target => {
        let times = summary.reduce( ( times, current ) => {
            current.id.toLowerCase() == target.toLowerCase() && ( current.protocol == protocol ) ? times.push( current.time ) : true;
            return times;
        }, [] );
        timesCategory[ 'overall' ][ target ] = average( times );
    } );

    args.category.map( category => {
        timesCategory[ `${ category } domains` ] = {};
        args.target.map( target => {
            let times = summary.reduce( ( times, current ) => {
                ( current.id.toLowerCase() == target.toLowerCase() ) && ( current.category == category ) && ( current.protocol == protocol ) ? times.push( current.time ) : true;
                return times;
            }, [] );
            timesCategory[ `${ category } domains` ][ target ] = average( times );
        } );
    } );

    console.table( timesCategory );
} );;
