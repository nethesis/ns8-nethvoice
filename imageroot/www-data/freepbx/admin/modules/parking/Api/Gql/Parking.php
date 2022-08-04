<?php

namespace FreePBX\modules\Parking\Api\Gql;

use GraphQL\Type\Definition\Type;
use FreePBX\modules\Api\Gql\Base;

class Parking extends Base {
	public function constructQuery() {
		return [
			'parkinglots' => [
				'type' => $this->typeContainer->get('parkinglot')->getListReference(),
				'resolve' => function($root, $args) {
					return $this->freepbx->Parking->getAllParkingLots();
				}
			],
			'parkinglot' => [
				'type' => $this->typeContainer->get('parkinglot')->getReference(),
				'args' => [
					'id' => [
						'type' => Type::int(),
						'description' => 'Device ID',
					]
				],
				'resolve' => function($root, $args) {
					return $this->freepbx->Parking->getParkingLotByID($args['id']);
				}
			]
		];
	}

	public function postInitReferences() {
		$parking = $this->typeContainer->get('parkinglot');
		$parking->addFields([
			'dest' => [
				'type' => $this->typeContainer->get('destination')->getReference()
			]
		]);
		$parking->addFields([
			'announcement_id' => [
				'type' => $this->typeContainer->get('recording')->getReference()
			]
		]);
		$parking->addFields([
			'parkedmusicclass' => [
				'type' => $this->typeContainer->get('music')->getReference()
			]
		]);
	}

	public function initReferences() {
		$parking = $this->typeContainer->get('parkinglot');
		$parking->addFields([
			'id' => [
				'type' => Type::id()
			],
			'name' => [
				'type' => Type::string()
			],
			'parkext' => [
				'type' => Type::int()
			],
			'parkpos' => [
				'type' => Type::int()
			],
			'numslots' => [
				'type' => Type::int()
			],
			'parkingtime' => [
				'type' => Type::int()
			],
			'findslot' => [
				'type' => Type::string()
			],
			'parkedplay' => [
				'type' => Type::string()
			],
			'parkedcalltransfers' => [
				'type' => Type::string()
			],
			'parkedcallreparking' => [
				'type' => Type::string()
			],
			'alertinfo' => [
				'type' => Type::string()
			],
			'rvolume' => [
				'type' => Type::string()
			],
			'cidpp' => [
				'type' => Type::string()
			],
			'autocidpp' => [
				'type' => Type::string()
			],
			'comebacktoorigin' => [
				'type' => Type::boolean(),
				'resolve' => function($row) {
					return ($row['comebacktoorigin'] == 'yes' ? 1 : 0);
				}
			]
		]);
	}
}
