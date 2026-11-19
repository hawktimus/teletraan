#!/usr/bin/env python3
"""Writes the three lists of systems that EmulationStation shows on the Pi, from the full list of the system.

    es-systems.py [--etc /etc/emulationstation/es_systems.cfg] [--roms ~/RetroPie/roms] [--out ~/.emulationstation]

menu    the first screen: Teletraan, Meeting, Arcade, Lo-Fi
arcade  what the Arcade entry opens: a Main Menu entry, then every game system of the full list
lofi    what the Lo-Fi tile of the home screen opens: a Main Menu entry, then Lo-Fi Radio

EmulationStation reads ~/.emulationstation/es_systems.cfg when it is there and /etc/emulationstation/es_systems.cfg when
it is not. menu.sh copies one of the two lists over that file and starts EmulationStation again. Nothing here changes the
full list, which stays as the way back (computer/pi/README.md).
"""
import argparse
import os
import xml.etree.ElementTree as ET


def block(name, fullname, path, command, theme, extension='.sh .SH'):
    system = ET.Element('system')
    for tag, text in (('name', name), ('fullname', fullname), ('path', path), ('extension', extension),
                      ('command', command), ('platform', 'pc'), ('theme', theme)):
        ET.SubElement(system, tag).text = text
    return system


def named(systems, name):
    for system in systems:
        if system.findtext('name') == name:
            return system
    return None


def write(path, systems):
    root = ET.Element('systemList')
    root.extend(systems)
    ET.indent(root, space='  ')
    tree = ET.ElementTree(root)
    temporary = path + '.new'
    tree.write(temporary, encoding='utf-8', xml_declaration=True)
    os.replace(temporary, path)


def main():
    home = os.path.expanduser('~')
    parser = argparse.ArgumentParser()
    parser.add_argument('--etc', default='/etc/emulationstation/es_systems.cfg')
    parser.add_argument('--roms', default=os.path.join(home, 'RetroPie', 'roms'))
    parser.add_argument('--out', default=os.path.join(home, '.emulationstation'))
    args = parser.parse_args()

    full = list(ET.parse(args.etc).getroot().findall('system'))
    if named(full, 'arcade') is None:
        raise SystemExit('Stopped: %s has no arcade system, so it is not the full list.' % args.etc)

    teletraan = named(full, 'teletraan')
    lofi = named(full, 'lofi')
    meeting = block('meeting', 'Meeting', os.path.join(args.roms, 'meeting'), 'bash %ROM%', 'meeting')
    # The theme of the real arcade system is used for the entry, so it shows the Arcade logo of the Hawktimus theme
    arcade_entry = block('arcademenu', 'Arcade', os.path.join(args.roms, 'arcademenu'), 'bash %ROM%', 'arcade')
    main_menu = block('mainmenu', 'Main Menu', os.path.join(args.roms, 'mainmenu'), 'bash %ROM%', 'mainmenu')

    menu = [system for system in (teletraan, meeting, arcade_entry, lofi) if system is not None]
    games = [system for system in full if system.findtext('name') not in ('teletraan', 'lofi')]
    write(os.path.join(args.out, 'es_systems.menu.cfg'), menu)
    write(os.path.join(args.out, 'es_systems.arcade.cfg'), [main_menu] + games)
    if lofi is not None:
        write(os.path.join(args.out, 'es_systems.lofi.cfg'), [main_menu, lofi])
    print('menu: %d systems, arcade: %d systems' % (len(menu), len(games) + 1))


if __name__ == '__main__':
    main()
