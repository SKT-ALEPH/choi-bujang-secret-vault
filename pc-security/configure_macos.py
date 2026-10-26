"""Patch owned settings only; Wazuh command text is not strict XML (e.g. &&)."""
import re
import xml.etree.ElementTree as E


def configure(text, root='/Library/Application Support/KeshevSecurity'):
    matches = list(re.finditer(r'<client>.*?</client>', text, re.S))
    if len(matches) != 1 or '</ossec_config>' not in text:
        raise ValueError('AGENT_CONFIGURATION_AMBIGUOUS')
    match = matches[0]
    client = E.fromstring(match.group())
    for tag in ('server', 'enrollment'):
        for node in client.findall(tag):
            client.remove(node)
    server = E.SubElement(client, 'server')
    for key, value in {'address': '10.211.55.2', 'port': '1514', 'protocol': 'tcp'}.items():
        E.SubElement(server, key).text = value
    enrollment = E.SubElement(client, 'enrollment')
    for key, value in {
        'enabled': 'yes', 'manager_address': '10.211.55.2', 'port': '1515',
        'agent_name': 'keshev-mac',
        'authorization_pass_path': '/Library/Ossec/etc/authd.pass',
        'server_ca_path': '/Library/Ossec/etc/manager-ca.pem',
    }.items():
        E.SubElement(enrollment, key).text = value
    result = text[:match.start()] + E.tostring(client, encoding='unicode') + text[match.end():]
    additions = []
    for name in ('network.jsonl', 'responses.jsonl'):
        path = root + '/' + name
        if re.search(r'<location>\s*' + re.escape(path) + r'\s*</location>', result):
            continue
        node = E.Element('localfile')
        E.SubElement(node, 'log_format').text = 'json'
        E.SubElement(node, 'location').text = path
        additions.append(E.tostring(node, encoding='unicode'))
    return result.replace('</ossec_config>', '\n'.join(additions) + '\n</ossec_config>', 1) if additions else result
