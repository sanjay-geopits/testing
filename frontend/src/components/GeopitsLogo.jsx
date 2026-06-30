import React from 'react';

/**
 * GeopitsLogo — pure HTML/CSS logo
 * @param {string} textColor  - CSS color for "geopits" text (default: 'var(--text-main)')
 * @param {number} fontSize   - rem value for text size (default: 1.5)
 * @param {string} dotSize    - size of the orange dot (default: '8px')
 */
const GeopitsLogo = ({ textColor = 'var(--text-main)', fontSize = 1.5, dotSize = '8px' }) => {
    const shapeSize = fontSize * 0.55; // shapes scale with text

    return (
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0, lineHeight: 1 }}>
            {/* Orange dot sits above the "i" — roughly 65% in from left */}
            <div style={{ paddingLeft: `${fontSize * 2.92}rem`, marginBottom: '-2px' }}>
                <span style={{
                    display: 'inline-block',
                    width: dotSize,
                    height: dotSize,
                    borderRadius: '50%',
                    background: '#f97316'
                }} />
            </div>

            {/* Main row: text + shapes */}
            <div style={{ display: 'flex', alignItems: 'center', gap: `${fontSize * 0.25}rem` }}>
                <span style={{
                    fontSize: `${fontSize}rem`,
                    fontWeight: '900',
                    letterSpacing: '-0.5px',
                    color: textColor,
                    fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif',
                    lineHeight: 1
                }}>
                    geopits
                </span>

                {/* Colored shapes */}
                <div style={{ display: 'flex', alignItems: 'center', gap: `${shapeSize * 0.25}rem`, marginBottom: '1px' }}>
                    {/* Orange triangle ▲ */}
                    <span style={{
                        display: 'inline-block',
                        width: 0, height: 0,
                        borderLeft:   `${shapeSize * 0.52}rem solid transparent`,
                        borderRight:  `${shapeSize * 0.52}rem solid transparent`,
                        borderBottom: `${shapeSize * 0.88}rem solid #ea580c`,
                        marginBottom: '2px'
                    }} />
                    {/* Teal circle ● */}
                    <span style={{
                        display: 'inline-block',
                        width:  `${shapeSize * 0.85}rem`,
                        height: `${shapeSize * 0.85}rem`,
                        borderRadius: '50%',
                        background: '#0d9488'
                    }} />
                    {/* Green square ■ */}
                    <span style={{
                        display: 'inline-block',
                        width:  `${shapeSize * 0.78}rem`,
                        height: `${shapeSize * 0.78}rem`,
                        background: '#65a30d',
                        borderRadius: '1px'
                    }} />
                </div>
            </div>
        </div>
    );
};

export default GeopitsLogo;
