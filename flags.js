// Flag quiz data: ISO 3166-1 alpha-2 code + English name.
// Images come from flagcdn.com (emoji flags do not render on Windows).
module.exports = [
    ['ar', 'Argentina'], ['au', 'Australia'], ['at', 'Austria'], ['be', 'Belgium'],
    ['br', 'Brazil'], ['bg', 'Bulgaria'], ['ca', 'Canada'], ['cl', 'Chile'],
    ['cn', 'China'], ['co', 'Colombia'], ['hr', 'Croatia'], ['cu', 'Cuba'],
    ['cz', 'Czechia'], ['dk', 'Denmark'], ['eg', 'Egypt'], ['ee', 'Estonia'],
    ['fi', 'Finland'], ['fr', 'France'], ['de', 'Germany'], ['gr', 'Greece'],
    ['hu', 'Hungary'], ['is', 'Iceland'], ['in', 'India'], ['id', 'Indonesia'],
    ['ie', 'Ireland'], ['il', 'Israel'], ['it', 'Italy'], ['jm', 'Jamaica'],
    ['jp', 'Japan'], ['ke', 'Kenya'], ['lv', 'Latvia'], ['lt', 'Lithuania'],
    ['lu', 'Luxembourg'], ['my', 'Malaysia'], ['mx', 'Mexico'], ['ma', 'Morocco'],
    ['np', 'Nepal'], ['nl', 'Netherlands'], ['nz', 'New Zealand'], ['ng', 'Nigeria'],
    ['kp', 'North Korea'], ['no', 'Norway'], ['pk', 'Pakistan'], ['pe', 'Peru'],
    ['ph', 'Philippines'], ['pl', 'Poland'], ['pt', 'Portugal'], ['qa', 'Qatar'],
    ['ro', 'Romania'], ['ru', 'Russia'], ['sa', 'Saudi Arabia'], ['rs', 'Serbia'],
    ['sg', 'Singapore'], ['sk', 'Slovakia'], ['si', 'Slovenia'], ['za', 'South Africa'],
    ['kr', 'South Korea'], ['es', 'Spain'], ['lk', 'Sri Lanka'], ['se', 'Sweden'],
    ['ch', 'Switzerland'], ['th', 'Thailand'], ['tr', 'Turkey'], ['ua', 'Ukraine'],
    ['ae', 'United Arab Emirates'], ['gb', 'United Kingdom'], ['us', 'United States'],
    ['uy', 'Uruguay'], ['vn', 'Vietnam'], ['ve', 'Venezuela'], ['bd', 'Bangladesh'],
    ['bo', 'Bolivia'], ['cm', 'Cameroon'], ['cr', 'Costa Rica'], ['gh', 'Ghana'],
    ['ir', 'Iran'], ['iq', 'Iraq'], ['kz', 'Kazakhstan'], ['mn', 'Mongolia'],
    ['pa', 'Panama'], ['py', 'Paraguay'], ['sn', 'Senegal'], ['tn', 'Tunisia'],
    ['mt', 'Malta'], ['cy', 'Cyprus'], ['al', 'Albania'], ['ba', 'Bosnia and Herzegovina'],
    ['by', 'Belarus'], ['ge', 'Georgia'], ['am', 'Armenia'], ['az', 'Azerbaijan']
].map(([code, name]) => ({ code, name }));
