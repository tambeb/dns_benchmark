'use strict';

const path = require( 'path' );
const fs = require( 'fs-extra' );
const root = path.resolve();
const https = require( 'https' );
const dnsPacket = require( 'dns-packet' );

var settings = openJsonSync( 'benchmark_settings.json' );
const protocols = Object.keys( settings.commands );
const domains = settings.domains;
const targets = settings.targets.reduce( ( acc, item ) => {
    acc.push( item.id );
    return acc;
}, [] );
var outputFileTemplate = settings.outputFileTemplate;

let args = {
    protocol: null,
    domain: null,
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
        console.log( `Usage: node benchmark protocol=PROTOCOL[,PROTOCOL] domain=DOMAINS[,DOMAINS] target=TARGET[,TARGET]` );
        console.group( 'protocol' );
        console.log( `Comma separated list of one or more of: ${ protocols }` );
        console.groupEnd();

        console.group( 'domains' );
        console.log( `Comma separated list of one or more of: ${ Object.keys( domains ) }` );
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

args.domain.map( item => {
    args.domainList[ item ] = settings.domains[ item ];
} );

const { execSync } = require( 'child_process' );

function dohRequest( hostname, path, dns, counter ) {
    return new Promise( function ( resolve, reject ) {
        let options = {
            hostname: hostname,
            port: 443,
            path: '/' + path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/dns-message',
                'Content-Length': Buffer.byteLength( dns )
            }
        };

        const req = https.request( options, ( res ) => {
            res.setEncoding( 'utf8' );
            res.on( 'data', ( chunk ) => {
            } );
            res.on( 'end', () => {
                let timing = Date.now() - start;
                let count = counter.count();
                resolve( { timing: timing, count: count } );
            } );
        } );

        req.on( 'error', ( e ) => {
            // console.log( e );
            reject( e );
        } );

        let start = Date.now();
        req.write( dns );
        req.end();
    } );
}
async function doh( data ) {
    for ( let i in data.target ) {
        let id = data.target[ i ].id;
        let doh = false || data.target[ i ].doh;
        let server = doh ? doh : data.target[ i ].server;
        let hostname = data.target[ i ].path == data.target[ i ].hostname ? "" : data.target[ i ].hostname;
        let path = data.target[ i ].path;

        let counter = runCounter( args.domainList[ data.domain ].length );

        for ( let site of args.domainList[ data.domain ] ) {
            let dns = dnsPacket.encode( {
                type: 'query',
                id: getRandomInt(),
                flags: dnsPacket.RECURSION_DESIRED,
                questions: [ {
                    type: 'A',
                    name: site
                } ]
            } );
            let cmdResult;
            try {
                cmdResult = await dohRequest( `${ hostname ? hostname + '.' : hostname }${ server }`, path, dns, counter );
            }
            catch ( err ) {
                console.log( 'not using hostname' );
                hostname = "";
                cmdResult = await dohRequest( `${ hostname ? hostname + '.' : hostname }${ server }`, path, dns, counter );
            }

            if ( cmdResult.timing ) {
                let result = `${ id },${ site },${ cmdResult.timing }`;
                appendNewLine( result, data.outputFileName, [ root ] );
                console.log( cmdResult.count + ' ' + result );
            }
            else {
                let result = `${ id },${ site }`;
                appendNewLine( result, data.outputFileName, [ root ] );
                console.log( cmdResult.count + ' ' + result );
            }
        }
        console.log( '***' );
    }
}
function execCmdSync( cmd, counter, type ) {
    let start = Date.now();
    let final = execSync( cmd, { encoding: 'utf8' } );
    let timing = Date.now() - start;
    let count = counter.count();
    let result;
    if ( type == 'dot' ) {
        result = parsegetDnsQueryResponse( final );
        if ( result ) {
            return { timing: timing, count: count };
        }
        else {
            return { timing: false, count: count };
        }
    }
    else if ( type.includes( 'dns' ) ) {
        let result = parseDigResponse( final );
        if ( result ) {
            return { timing: timing, count: count };
        }
        else {
            return { timing: false, count: count };
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
function saveFile( fileName, data, filePath = root ) {
    return new Promise( function ( resolve, reject ) {
        let file = path.join( ...filePath, fileName );
        fs.writeFile( file, data ).then( () => {
            resolve();
        } ).catch( err => {
            reject( err );
        } );
    } );
}
function openFile( fileName, filePath = root ) {
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
            return `${ current }/${ total }:`;
        }
    };
};
var getRandomInt = function () {
    return Math.floor( Math.random() * ( 65534 - 1 + 1 ) ) + 1;
};

args.protocol.forEach( protocol => {
    protocol = protocol.toLowerCase();
    if ( protocol != 'doh' ) {
        args.domain.forEach( domain => {
            let timestamp = getYYYYMMDDHHMMSSTime();
            args.targetData.forEach( target => {
                let command = settings.commands[ protocol ];
                let id = target.id;
                let dot = false || target.dot;
                let server = dot ? dot : target.server;
                let hostname = dot ? "" : target.hostname;
                let outputFileName = eval( '`' + outputFileTemplate + '`' );
                let counter = runCounter( args.domainList[ domain ].length );
                args.domainList[ domain ].forEach( ( site ) => {
                    let cmdResult = execCmdSync( generateCmd( { url: site, server: server, hostname: hostname }, command ), counter, protocol );
                    if ( cmdResult.timing ) {
                        let result = `${ id },${ site },${ cmdResult.timing }`;
                        appendNewLine( result, outputFileName, [ root ] );
                        console.log( cmdResult.count + ' ' + result );
                    }
                    else {
                        let result = `${ id },${ site }`;
                        appendNewLine( result, outputFileName, [ root ] );
                        console.log( cmdResult.count + ' ' + result );
                    }
                } );
                console.log( '***' );
            } );
        } );
    }
    else {
        args.domain.forEach( domain => {
            let timestamp = getYYYYMMDDHHMMSSTime();
            let outputFileName = eval( '`' + outputFileTemplate + '`' );
            doh( { outputFileName: outputFileName, target: args.targetData, domain: domain } );
        } );
    }
} );

process.on( 'warning', ( warning ) => { console.log( warning ); } );
process.on( 'unhandledRejection', ( reason, promise ) => { console.log( reason ); console.log( promise ); } );
process.on( 'uncaughtException', ( err ) => { console.log( err ); } );