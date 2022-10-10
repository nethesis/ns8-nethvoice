<?php

namespace FreePBX\modules\Ringgroups\Api\Gql;

use GraphQL\Type\Definition\Type;
use FreePBX\modules\Api\Gql\Base;
use GraphQL\Type\Definition\EnumType;

use GraphQLRelay\Relay;

class Ringgroups extends Base {
	protected $module = 'ringgroups';

	public function constructQuery() {
		if($this->checkAllReadScope()) {
			return [
				'allRinggroups' => [
					'type' => $this->typeContainer->get('ringgroup')->getConnectionReference(),
					'description' => 'Used to manage a system wide list of blocked callers',
					'args' => Relay::connectionArgs(),
					'resolve' => function($root, $args) {
						return Relay::connectionFromArray($this->freepbx->Ringgroups->getAllGroups(), $args);
					},
				],
				'ringgroup' => [
					'type' => $this->typeContainer->get('ringgroup')->getReference(),
					'args' => [
						'id' => [
							'type' => Type::id(),
							'description' => 'The ID',
						]
					],
					'resolve' => function($root, $args) {
						$item = $this->freepbx->Ringgroups->getGroupByID(Relay::fromGlobalId($args['id'])['id']);
						return isset($item) ? $item : null;
					}
				]
			];
		}
	}

	public function postInitTypes() {
		$destinations = $this->typeContainer->get('destination');
		$destinations->addType($this->typeContainer->get('ringgroup')->getReference());
	}

	public function initTypes() {
		$user = $this->typeContainer->create('ringgroup');
		$user->setDescription('Used to manage a system wide list of blocked callers');

		$user->addInterfaceCallback(function() {
			return [$this->getNodeDefinition()['nodeInterface']];
		});

		$user->setGetNodeCallback(function($id) {
			$item = $this->freepbx->Ringgroups->getGroupByID($id);
			return isset($item) ? $item : null;
		});

		$user->addFieldCallback(function() {
			return [
				'id' => Relay::globalIdField('ringgroup', function($row) {
					return $row['grpnum'];
				}),
				'description' => [
					'type' => Type::string(),
					'description' => 'A descriptive title for this Ring Group'
				],
				'grplist' => [
					'type' => Type::string(),
					'description' => 'extensions to ring, one per line'
				],
				'grptime' => [
					'type' => Type::int(),
					'description' => 'Time in seconds that the phones will ring. For all hunt style ring strategies, this is the time for each iteration of phone(s) that are rung'
				],
				'annmsg_id' => [
					'type' => $this->typeContainer->get('recording')->getObject(),
					'description' => 'Message to be played to the caller before dialing this group',
				],
				'strategy' => [
					'type' => new EnumType([
						'name' => 'ringstrategies',
						'description' => 'Ring Strategies',
						'values' => [
							'ringall' => [
								'value' => 'ringall',
								'description' => 'Ring all available channels until one answers (default)'
							],
							'ringallprim' => [
								'value' => 'ringall-prim',
								'description' => "Ring all available channels until one answers. If the primary extension (first in list) is occupied, the other extensions will not be rung. If the primary is FreePBX DND, it won't be rung. If the primary is FreePBX CF unconditional, then all will be rung"
							],
							'hunt' => [
								'value' => 'hunt',
								'description' => 'Take turns ringing each available extension'
							],
							'huntprim' => [
								'value' => 'hunt-prim',
								'description' => "Take turns ringing each available extension. If the primary extension (first in list) is occupied, the other extensions will not be rung. If the primary is FreePBX DND, it won't be rung. If the primary is FreePBX CF unconditional, then all will be rung"
							],
							'memoryhunt' => [
								'value' => 'memoryhunt',
								'description' => 'Ring first extension in the list, then ring the 1st and 2nd extension, then ring 1st 2nd and 3rd extension in the list.... etc'
							],
							'memoryhuntprim' => [
								'value' => 'memoryhunt-prim',
								'description' => "Ring first extension in the list, then ring the 1st and 2nd extension, then ring 1st 2nd and 3rd extension in the list.... etc. If the primary extension (first in list) is occupied, the other extensions will not be rung. If the primary is FreePBX DND, it won't be rung. If the primary is FreePBX CF unconditional, then all will be rung"
							],
							'firstavailable' => [
								'value' => 'firstavailable',
								'description' => 'Ring only the first available channel'
							],
							'firstnotonphone' => [
								'value' => 'firstnotonphone',
								'description' => 'Ring only the first channel which is not offhook - ignore CW'

							]
						]
					]),
					'description' => 'Ring Strategy'
				],
				/*
				'destination' => [
					'type' => $this->typeContainer->get('destination')->getObject(),
					'description' => 'Where to send callers if there is no answer',
					'resolve' => function($row) {
						$info = $this->freepbx->Destinations->getDestination($row['postdest']);
						return !empty($info['data']) ? $info['data'] : ['gqltype' => 'invaliddestination', 'id' => $row['postdest'], 'description' => ''];
					}
				],
				*/
			];
		});

		$user->setConnectionResolveNode(function ($edge) {
			return $edge['node'];
		});

		$user->setConnectionFields(function() {
			return [
				'totalCount' => [
					'type' => Type::int(),
					'resolve' => function($value) {
						return count($this->freepbx->Ringgroups->getAllGroups());
					}
				],
				'ringgroups' => [
					'type' => Type::listOf($this->typeContainer->get('ringgroup')->getObject()),
					'resolve' => function($root, $args) {
						$data = array_map(function($row){
							return $row['node'];
						},$root['edges']);
						return $data;
					}
				]
			];
		});
	}
}
